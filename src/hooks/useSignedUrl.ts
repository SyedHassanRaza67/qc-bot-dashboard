import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSignedUrl = (storagePath: string | null) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!storagePath) {
        setSignedUrl(null);
        return;
      }

      // Check if it's already a full URL (legacy data) or a storage path
      if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
        setSignedUrl(storagePath);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-signed-url', {
          body: { storagePath }
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (!data.success) {
          throw new Error(data.error || 'Failed to get signed URL');
        }

        setSignedUrl(data.signedUrl);
      } catch (err) {
        console.error('Error fetching signed URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recording');
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSignedUrl();
  }, [storagePath]);

  return { signedUrl, isLoading, error };
};
