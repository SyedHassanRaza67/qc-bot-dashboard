import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Debounce transcription triggers to avoid multiple calls
const DEBOUNCE_MS = 3000;

export const useAutoTranscription = () => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingRecordId, setTranscribingRecordId] = useState<string | null>(null);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<{
    success: boolean;
    processed?: number;
    successCount?: number;
    failCount?: number;
    error?: string;
  } | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTriggerRef = useRef<number>(0);

  // Debounced trigger - waits for DEBOUNCE_MS after the last call
  const triggerTranscription = useCallback((pendingCount: number) => {
    pendingTriggerRef.current = pendingCount;
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounced timer
    debounceTimerRef.current = setTimeout(async () => {
      if (isTranscribing || pendingTriggerRef.current === 0) return;
      
      setIsTranscribing(true);
      try {
        console.log(`[AutoTranscription] Triggering for ${pendingTriggerRef.current} records`);
        
        // Use SDK invoke instead of raw fetch for proper auth handling
        const { data, error } = await supabase.functions.invoke('transcribe-background', {
          body: { limit: pendingTriggerRef.current, concurrency: 5 }
        });
        
        if (error) {
          console.error('[AutoTranscription] Error:', error);
          
          // Check for specific error types
          if (error.message?.includes('402')) {
            toast.error('AI credits exhausted', {
              description: 'Please add funds to continue transcription.',
            });
          } else if (error.message?.includes('429')) {
            toast.error('Rate limit reached', {
              description: 'Please wait a moment before transcribing more.',
            });
          }
          
          setLastTranscriptionResult({ success: false, error: error.message });
        } else if (data) {
          console.log('[AutoTranscription] Result:', data);
          setLastTranscriptionResult({
            success: data.success,
            processed: data.processed,
            successCount: data.success_count,
            failCount: data.fail_count,
          });
          
          if (data.fail_count > 0) {
            toast.warning(`Transcription: ${data.success_count}/${data.processed} completed`, {
              description: `${data.fail_count} records failed - check details for errors`,
            });
          }
        }
      } catch (err) {
        console.error('[AutoTranscription] Exception:', err);
        setLastTranscriptionResult({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      } finally {
        setIsTranscribing(false);
        pendingTriggerRef.current = 0;
      }
    }, DEBOUNCE_MS);
  }, [isTranscribing]);

  // Single record transcription (for manual retry on specific record)
  const transcribeSingleRecord = useCallback(async (recordId: string) => {
    if (transcribingRecordId) {
      toast.info('A transcription is already in progress');
      return;
    }
    
    setTranscribingRecordId(recordId);
    try {
      console.log(`[SingleTranscription] Starting for record: ${recordId}`);
      
      const { data, error } = await supabase.functions.invoke('transcribe-background', {
        body: { record_id: recordId }
      });
      
      if (error) {
        if (error.message?.includes('402')) {
          toast.error('AI credits exhausted', {
            description: 'Please add funds to continue transcription.',
          });
        } else if (error.message?.includes('429')) {
          toast.error('Rate limit reached', {
            description: 'Please wait before transcribing more.',
          });
        } else {
          toast.error('Transcription failed', {
            description: error.message,
          });
        }
        return;
      }
      
      if (data?.success) {
        toast.success('Transcription completed');
      } else if (data?.fail_count > 0) {
        toast.warning('Transcription had issues', {
          description: 'Check the record for details',
        });
      }
      
      return data;
    } catch (err) {
      console.error('[SingleTranscription] Error:', err);
      toast.error('Failed to transcribe record');
    } finally {
      setTranscribingRecordId(null);
    }
  }, [transcribingRecordId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isTranscribing,
    transcribingRecordId,
    triggerTranscription,
    transcribeSingleRecord,
    lastTranscriptionResult,
  };
};
