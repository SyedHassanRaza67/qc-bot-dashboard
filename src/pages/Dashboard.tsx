import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, RefreshCw, CloudDownload, Upload, Phone, Settings, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { StatsGrid } from "@/components/StatsGrid";
import { CallRecordsTable } from "@/components/CallRecordsTable";
import { LiveStatusIndicator } from "@/components/LiveStatusIndicator";
import { CallDetailDialog } from "@/components/CallDetailDialog";
import { useCallRecords, useCallStats } from "@/hooks/useCallRecords";
import { useLiveSync } from "@/hooks/useLiveSync";
import { useAutoTranscription } from "@/hooks/useAutoTranscription";
import { DateRangePicker } from "@/components/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Local storage keys for filter persistence
const STORAGE_KEYS = {
  sourceFilter: 'dashboard-source-filter',
  statusFilter: 'dashboard-status-filter',
  dateRangeManuallySet: 'dashboard-date-manually-set',
};

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Default to today unless user manually changed the filter
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    return { from: todayStart, to: today };
  });
  
  const [dateManuallySet, setDateManuallySet] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.dateRangeManuallySet) === 'true';
  });
  
  // Handle date range change - mark as manually set
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setDateManuallySet(true);
    localStorage.setItem(STORAGE_KEYS.dateRangeManuallySet, 'true');
  };
  
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
  const [pendingCount, setPendingCount] = useState(0);

  // Live sync hook with auto-sync and health status
  const { 
    isLive, 
    toggleLive, 
    healthStatus, 
    lastSyncAt, 
    lastError, 
    isSyncing, 
    syncRecordings 
  } = useLiveSync();

  // Auto transcription hook with debouncing
  const { 
    isTranscribing, 
    transcribingRecordId,
    triggerTranscription, 
    transcribeSingleRecord 
  } = useAutoTranscription();

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

  const records = paginatedData?.records || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 1;

  const processingCount = records.filter(r => r.isProcessing).length;

  // Count pending records and auto-trigger transcription (skip records still processing audio)
  useEffect(() => {
    const pending = records.filter(r => r.summary === 'Pending AI analysis' && !r.isProcessing);
    const transcribing = records.filter(r => r.summary === 'Transcribing...');

    setPendingCount(pending.length + transcribing.length);

    // Auto-trigger transcription when pending records exist (debounced)
    if (pending.length > 0 && !isTranscribing) {
      triggerTranscription(pending.length);
    }
  }, [records, isTranscribing, triggerTranscription]);

  // Auto-retry VICIdial recordings that are still converting (checks every minute)
  useEffect(() => {
    if (processingCount === 0) return;

    let cancelled = false;

    const tick = async () => {
      const { data, error } = await supabase.functions.invoke('retry-wav-recordings', {
        body: { minAgeSeconds: 60, limit: 200 },
      });

      if (error) {
        console.error('[AudioRetry] retry-wav-recordings error:', error);
        return;
      }

      if (!cancelled && (data?.updated ?? 0) > 0) {
        refetch();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [processingCount, refetch]);

  // Real-time subscription - triggers transcription on new inserts
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
          
          // On INSERT, trigger auto-transcription for the new record
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as any;
            if (newRecord?.summary === 'Pending AI analysis' && !newRecord?.is_processing) {
              triggerTranscription(1); // Will be debounced
            }

            if (isLive) {
              toast.success('New call record received!', {
                description: `Call ID: ${newRecord.system_call_id}`,
              });
            }
          } else if (payload.eventType === 'UPDATE' && isLive) {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            // Check if transcription completed
            if (oldData?.summary === 'Transcribing...' && 
                newData?.summary !== 'Transcribing...' &&
                newData?.summary !== 'Pending AI analysis') {
              toast.success('Transcription completed!', {
                description: `Record updated with AI analysis`,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, refetch, refetchStats, triggerTranscription]);

  const handleSyncFromDialer = async () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const fromDate = dateRange?.from?.toISOString().split('T')[0] ?? sevenDaysAgo.toISOString().split('T')[0];
    const toDate = dateRange?.to?.toISOString().split('T')[0] ?? today.toISOString().split('T')[0];
    
    toast.info('Syncing recordings...', {
      description: `Fetching from ${fromDate} to ${toDate}`,
    });
    
    const result = await syncRecordings(fromDate, toDate);
    
    // Refresh data after sync
    if (result?.success || result?.inProgress) {
      setTimeout(() => refetch(), result?.inProgress ? 5000 : 1000);
    }
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

  // Manual transcription handler for specific record - passed to table
  const handleTranscribeRecord = useCallback(async (recordId: string) => {
    await transcribeSingleRecord(recordId);
    setTimeout(() => refetch(), 2000);
  }, [transcribeSingleRecord, refetch]);

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
            <Link to="/settings">
              <Button variant="outline" size="icon" className="rounded-xl">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Search & Controls */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Campaign or System Call ID..."
              className="pl-10 rounded-xl h-10"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />

            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="icon"
              className="rounded-xl h-10 w-10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button 
              onClick={() => {
                setSearchQuery("");
                setSourceFilter("all");
                setStatusFilter("all");
                setDateManuallySet(false);
                localStorage.removeItem('dashboard-source-filter');
                localStorage.removeItem('dashboard-status-filter');
                localStorage.removeItem(STORAGE_KEYS.dateRangeManuallySet);
                // Reset to today
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const todayStart = new Date(today);
                todayStart.setHours(0, 0, 0, 0);
                setDateRange({ from: todayStart, to: today });
                toast.success('Filters reset');
              }} 
              variant="outline" 
              size="icon"
              className="rounded-xl h-10 w-10"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sync Controls & Source Filters Card */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Source Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground mr-2">Source:</span>
              <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
                <button
                  onClick={() => handleSourceFilterChange('all')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                    sourceFilter === 'all' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  All Calls
                </button>
                <button
                  onClick={() => handleSourceFilterChange('manual')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5',
                    sourceFilter === 'manual' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Manual
                </button>
                <button
                  onClick={() => handleSourceFilterChange('vicidial')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5',
                    sourceFilter === 'vicidial' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Phone className="h-3.5 w-3.5" />
                  VICIdial
                </button>
              </div>
            </div>

            {/* Consolidated Sync Controls */}
            <div className="flex items-center gap-2">
              {/* Live Status Toggle */}
              <LiveStatusIndicator
                isLive={isLive}
                healthStatus={healthStatus}
                isSyncing={isSyncing}
                lastError={lastError}
                lastSyncAt={lastSyncAt}
                onToggle={toggleLive}
              />

              {/* Manual Sync - only show when Live is OFF or when user needs to force sync */}
              {!isLive && (
                <Button 
                  onClick={handleSyncFromDialer} 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl gap-2"
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudDownload className="h-4 w-4" />
                  )}
                  {isSyncing ? 'Syncing...' : 'Manual Sync'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <StatsGrid stats={stats} activeFilter={statusFilter} onFilterClick={handleStatusFilterChange} />
        
        <CallRecordsTable 
          records={filteredRecords} 
          loading={recordsLoading} 
          onViewRecord={handleViewRecord}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          onTranscribeRecord={handleTranscribeRecord}
          transcribingRecordId={transcribingRecordId}
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
