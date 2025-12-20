import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, RefreshCw, CloudDownload, Upload, Phone, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { StatsGrid } from "@/components/StatsGrid";
import { CampaignFilters } from "@/components/CampaignFilters";
import { CallRecordsTable } from "@/components/CallRecordsTable";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useCallRecords, useCallStats } from "@/hooks/useCallRecords";
import { useViciSync } from "@/hooks/useViciSync";
import { DateRangePicker } from "@/components/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: records = [], isLoading: recordsLoading, refetch } = useCallRecords(dateRange, statusFilter, sourceFilter);
  const { data: stats, refetch: refetchStats } = useCallStats(dateRange, sourceFilter);
  const { isSyncing, syncRecordings } = useViciSync();

  // Real-time subscription - always on for auto-updates (transcription status changes)
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-call-records')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_records'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          refetch();
          refetchStats();
          
          // Only show toasts in Live mode
          if (isLive) {
            if (payload.eventType === 'INSERT') {
              toast.success('New call record received!', {
                description: `Call ID: ${(payload.new as any).system_call_id}`,
              });
            } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              const oldData = payload.old as any;
              // Check if transcription completed
              if (oldData?.summary === 'Transcribing...' && newData?.summary !== 'Transcribing...') {
                toast.success('Transcription completed!', {
                  description: `Record updated with AI analysis`,
                });
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active');
          if (isLive) {
            toast.success('Live mode activated', {
              description: 'You will receive real-time updates',
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (isLive) {
        toast.info('Live mode deactivated');
      }
    };
  }, [isLive, refetch, refetchStats]);

  const handleLiveToggle = () => {
    setIsLive(!isLive);
  };

  const handleSyncFromDialer = async () => {
    // Sync last 7 days by default, or use selected date range
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const fromDate = dateRange?.from 
      ? dateRange.from.toISOString().split('T')[0] 
      : sevenDaysAgo.toISOString().split('T')[0];
    const toDate = dateRange?.to 
      ? dateRange.to.toISOString().split('T')[0] 
      : today.toISOString().split('T')[0];
    
    await syncRecordings(fromDate, toDate);
    refetch();
  };

  const filteredRecords = records.filter(record => 
    searchQuery === "" || 
    record.systemCallId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.campaignName.toLowerCase().includes(searchQuery.toLowerCase())
  ).map(record => ({
    ...record,
    uploadSource: record.uploadSource,
  }));

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-6"
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Track, manage, and analyze your call recordings</p>
          </div>
          <SyncIndicator isSyncing={isSyncing} />
        </div>

        {/* Search & Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Campaign or System Call ID..."
              className="pl-10 rounded-xl"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleLiveToggle}
              className={`rounded-xl gap-2 transition-all duration-200 ${
                isLive 
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              <Radio className={`h-4 w-4 ${isLive ? 'animate-pulse' : ''}`} />
              Live
            </Button>

            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="icon"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="rounded-xl transition-all duration-200 hover:shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
            
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            <Button 
              onClick={handleSyncFromDialer} 
              variant="outline" 
              className="rounded-xl"
              disabled={isSyncing}
            >
              <CloudDownload className="h-4 w-4 mr-2" />
              Sync from Dialer
            </Button>

            <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Source Filter Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            variant={sourceFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setSourceFilter('all')}
            className="rounded-xl"
          >
            All Calls
          </Button>
          <Button
            variant={sourceFilter === 'manual' ? 'default' : 'outline'}
            onClick={() => setSourceFilter('manual')}
            className="rounded-xl gap-2"
          >
            <Upload className="h-4 w-4" />
            Manual Uploads
          </Button>
          <Button
            variant={sourceFilter === 'vicidial' ? 'default' : 'outline'}
            onClick={() => setSourceFilter('vicidial')}
            className="rounded-xl gap-2"
          >
            <Phone className="h-4 w-4" />
            VICIdial
          </Button>
        </div>

        <StatsGrid stats={stats} activeFilter={statusFilter} onFilterClick={setStatusFilter} />
        
        <CampaignFilters
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        />
        
        <CallRecordsTable records={filteredRecords} loading={recordsLoading} />
      </motion.div>
    </div>
  );
};

export default Dashboard;
