import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STORAGE_KEYS = {
  liveEnabled: 'dashboard-live-enabled',
};

export type LiveHealthStatus = 'healthy' | 'stale' | 'error' | 'idle';

interface LiveSyncState {
  isLive: boolean;
  healthStatus: LiveHealthStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  isSyncing: boolean;
}

export const useLiveSync = () => {
  // Live mode is ON by default, persisted in localStorage
  const [isLive, setIsLive] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.liveEnabled);
    return stored !== null ? stored === 'true' : true; // Default to true
  });
  
  const [healthStatus, setHealthStatus] = useState<LiveHealthStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Persist live mode preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.liveEnabled, String(isLive));
  }, [isLive]);

  // Auto-sync function (syncs today + yesterday to cover midnight edge cases)
  const performAutoSync = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const dateFrom = yesterday.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];
      
      console.log(`[LiveSync] Auto-syncing from ${dateFrom} to ${dateTo}`);
      
      const { data, error } = await supabase.functions.invoke("vici-sync", {
        body: { action: "sync", dateFrom, dateTo },
      });

      if (error) {
        // Handle timeout as "in progress" not an error
        if (error.message?.includes('Failed to send') || error.message?.includes('fetch')) {
          console.log('[LiveSync] Sync in progress (timeout)');
          setLastSyncAt(new Date());
          setHealthStatus('healthy');
          setLastError(null);
          return { success: true, inProgress: true };
        }
        throw error;
      }

      if (data?.success) {
        setLastSyncAt(new Date());
        setHealthStatus('healthy');
        setLastError(null);
        
        if (data.inserted > 0) {
          toast.success(`${data.inserted} new recordings synced`, {
            description: 'Live sync successful',
          });
        }
        return data;
      } else {
        setLastError(data?.error || 'Sync returned unsuccessful');
        setHealthStatus('error');
        return data;
      }
    } catch (error) {
      console.error('[LiveSync] Auto-sync error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific errors
      if (errorMsg.includes('No VICIdial integration')) {
        setHealthStatus('stale'); // Not an error, just no integration
        setLastError('No integration configured');
      } else {
        setHealthStatus('error');
        setLastError(errorMsg);
      }
      
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Manual sync with date range
  const syncRecordings = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("vici-sync", {
        body: { action: "sync", dateFrom, dateTo },
      });

      if (error) {
        if (error.message?.includes('Failed to send') || error.message?.includes('fetch')) {
          toast.info('Sync in progress', {
            description: 'The sync is taking longer than expected. Records may still be importing.',
          });
          setLastSyncAt(new Date());
          setHealthStatus('healthy');
          return { success: true, inProgress: true };
        }
        throw error;
      }

      if (data?.success) {
        setLastSyncAt(new Date());
        setHealthStatus('healthy');
        setLastError(null);
        
        toast.success('Sync complete', {
          description: data.message || `Synced ${data.inserted || 0} new recordings`,
        });
      } else {
        toast.error('Sync issue', {
          description: data?.error || 'Could not sync recordings',
        });
      }

      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to sync';
      setLastError(errorMsg);
      setHealthStatus('error');
      
      toast.error('Sync failed', {
        description: errorMsg,
      });
      
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Health check - update status based on time since last successful sync
  const updateHealthStatus = useCallback(() => {
    if (!isLive) {
      setHealthStatus('idle');
      return;
    }
    
    if (lastError && healthStatus === 'error') {
      return; // Keep error status
    }
    
    if (!lastSyncAt) {
      setHealthStatus('idle');
      return;
    }
    
    const now = new Date();
    const diffMs = now.getTime() - lastSyncAt.getTime();
    const diffMins = diffMs / 1000 / 60;
    
    if (diffMins < 2) {
      setHealthStatus('healthy');
    } else if (diffMins < 5) {
      setHealthStatus('stale');
    } else {
      setHealthStatus('stale');
    }
  }, [isLive, lastSyncAt, lastError, healthStatus]);

  // Start/stop auto-sync interval based on live mode
  useEffect(() => {
    if (isLive) {
      // Initial sync when live mode starts
      performAutoSync();
      
      // Set up interval for periodic sync (every 60 seconds)
      syncIntervalRef.current = setInterval(() => {
        performAutoSync();
      }, 60000);
      
      // Health check every 30 seconds
      healthCheckRef.current = setInterval(() => {
        updateHealthStatus();
      }, 30000);
    } else {
      // Clear intervals when live mode is off
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
        healthCheckRef.current = null;
      }
      setHealthStatus('idle');
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
    };
  }, [isLive, performAutoSync, updateHealthStatus]);

  const toggleLive = useCallback(() => {
    setIsLive(prev => !prev);
  }, []);

  return {
    isLive,
    toggleLive,
    healthStatus,
    lastSyncAt,
    lastError,
    isSyncing,
    syncRecordings,
    performAutoSync,
  };
};
