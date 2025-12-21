import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useViciSync = () => {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    message: string;
    total?: number;
    inserted?: number;
  } | null>(null);

  const syncRecordings = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsSyncing(true);
    
    // Create an AbortController with 120 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    try {
      const { data, error } = await supabase.functions.invoke("vici-sync", {
        body: { action: "sync", dateFrom, dateTo },
      });

      clearTimeout(timeoutId);

      if (error) {
        // Check if it's a timeout or network error
        if (error.message?.includes('Failed to send') || error.message?.includes('fetch')) {
          // The sync might still be running in the background
          toast({
            title: "Sync In Progress",
            description: "The sync is taking longer than expected. Records may still be importing. Please refresh in a moment.",
          });
          return { success: true, message: "Sync in progress", inProgress: true };
        }
        throw error;
      }

      setLastSyncResult(data);

      if (data?.success) {
        toast({
          title: "Sync Complete",
          description: data.message || `Synced ${data.inserted || 0} new recordings`,
        });
      } else {
        toast({
          title: "Sync Issue",
          description: data?.error || "Could not sync recordings",
          variant: "destructive",
        });
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Sync error:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to sync";
      
      // Handle specific error types
      if (errorMessage.includes('Failed to send') || errorMessage.includes('AbortError')) {
        toast({
          title: "Sync In Progress",
          description: "The sync is taking longer than expected. Records may still be importing in the background.",
        });
        setLastSyncResult({ success: true, message: "Sync in progress" });
        return { success: true, message: "Sync in progress", inProgress: true };
      }
      
      setLastSyncResult({ success: false, message: errorMessage });
      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  return {
    isSyncing,
    syncRecordings,
    lastSyncResult,
  };
};
