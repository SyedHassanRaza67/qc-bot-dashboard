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
    try {
      const { data, error } = await supabase.functions.invoke("vici-sync", {
        body: { action: "sync", dateFrom, dateTo },
      });

      if (error) throw error;

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
      console.error("Sync error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sync";
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
