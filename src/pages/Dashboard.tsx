import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, RefreshCw, CloudDownload, Upload, Phone, Radio, Zap, Settings, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { StatsGrid } from "@/components/StatsGrid";
import { CampaignFilters } from "@/components/CampaignFilters";
import { CallRecordsTable } from "@/components/CallRecordsTable";
import { SyncIndicator } from "@/components/SyncIndicator";
import { CallDetailDialog } from "@/components/CallDetailDialog";
import { useCallRecords, useCallStats } from "@/hooks/useCallRecords";
import { useViciSync } from "@/hooks/useViciSync";
import { DateRangePicker } from "@/components/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Local storage keys for filter persistence
const STORAGE_KEYS = {
  sourceFilter: 'dashboard-source-filter',
  statusFilter: 'dashboard-status-filter',
};

const Dashboard = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Default to today's date to reduce initial load
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { from: today, to: today };
  });
  const [currentPage, setCurrentPage] = useState(1);
  
  // Restore filters from localStorage
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.statusFilter) || "all";
  });
  const [sourceFilter, setSourceFilter] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.sourceFilter) || "all";
  });
  
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sourceFilter, sourceFilter);
  }, [sourceFilter]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.statusFilter, statusFilter);
  }, [statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, statusFilter, sourceFilter, searchQuery]);

  const { data: paginatedData, isLoading: recordsLoading, refetch } = useCallRecords(
    dateRange, 
    statusFilter, 
    sourceFilter, 
    currentPage
  );
  const { data: stats, refetch: refetchStats } = useCallStats(dateRange, sourceFilter);
  const { isSyncing, syncRecordings } = useViciSync();

  const records = paginatedData?.records || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 1;

  // Count pending records
  useEffect(() => {
    const count = records.filter(r => 
      r.summary === 'Pending AI analysis' || r.summary === 'Transcribing...'
    ).length;
    setPendingCount(count);
  }, [records]);

  // Handle transcribe all pending records
  const handleTranscribeAll = async () => {
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-pending', {
        body: { limit: 20 }
      });
      
      if (error) throw error;
      
      toast.success('Transcription started', {
        description: `Processing ${data?.processed || 0} records`
      });
      
      // Refetch after a short delay
      setTimeout(() => refetch(), 2000);
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Failed to start transcription');
    } finally {
      setIsTranscribing(false);
    }
  };

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
    
    toast.info('Syncing recordings...', {
      description: 'Transcription happens automatically during sync',
    });
    
    const result = await syncRecordings(fromDate, toDate);
    
    if (result?.transcribed !== undefined) {
      toast.success('Sync complete with transcription', {
        description: `${result.inserted} synced, ${result.transcribed} transcribed`,
      });
    }
    
    refetch();
  };

  const handleViewRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    setDialogOpen(true);
  };

  const handleSourceFilterChange = (filter: string) => {
    setSourceFilter(filter);
  };

  const handleStatusFilterChange = (filter: string) => {
    setStatusFilter(filter);
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
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto px-6"
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Track, manage, and analyze your call recordings</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator isSyncing={isSyncing} />
            <Link to="/settings">
              <Button variant="outline" size="icon" className="rounded-xl">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
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

            <Button 
              onClick={() => {
                setSearchQuery("");
                setSourceFilter("all");
                setStatusFilter("all");
                localStorage.removeItem('dashboard-source-filter');
                localStorage.removeItem('dashboard-status-filter');
                toast.success('Filters reset');
              }} 
              variant="outline" 
              className="rounded-xl gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>

            {pendingCount > 0 && (
              <Button 
                onClick={handleTranscribeAll}
                variant="default"
                className="rounded-xl gap-2 bg-amber-500 hover:bg-amber-600"
                disabled={isTranscribing}
              >
                <Zap className={`h-4 w-4 ${isTranscribing ? 'animate-pulse' : ''}`} />
                Transcribe ({pendingCount})
              </Button>
            )}
          </div>
        </div>

        {/* Source Filter Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            variant={sourceFilter === 'all' ? 'default' : 'outline'}
            onClick={() => handleSourceFilterChange('all')}
            className="rounded-xl"
          >
            All Calls
          </Button>
          <Button
            variant={sourceFilter === 'manual' ? 'default' : 'outline'}
            onClick={() => handleSourceFilterChange('manual')}
            className="rounded-xl gap-2"
          >
            <Upload className="h-4 w-4" />
            Manual Uploads
          </Button>
          <Button
            variant={sourceFilter === 'vicidial' ? 'default' : 'outline'}
            onClick={() => handleSourceFilterChange('vicidial')}
            className="rounded-xl gap-2"
          >
            <Phone className="h-4 w-4" />
            VICIdial
          </Button>
        </div>

        <StatsGrid stats={stats} activeFilter={statusFilter} onFilterClick={handleStatusFilterChange} />
        
        <CampaignFilters
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        />
        
        <CallRecordsTable 
          records={filteredRecords} 
          loading={recordsLoading} 
          onViewRecord={handleViewRecord}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
        />

        <CallDetailDialog 
          recordId={selectedRecordId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </motion.div>
    </div>
  );
};

export default Dashboard;
