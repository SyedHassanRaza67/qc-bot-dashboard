import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate multiple URL variations to try
const getUrlVariations = (baseUrl: string, originalUrl: string, recordingId: string, leadId: string | null, timestamp: string | null): string[] => {
  const variations: string[] = [];
  
  // If we have the original URL, add variations based on it
  if (originalUrl) {
    // Original URL as-is
    variations.push(originalUrl);
    
    // Try HTTP instead of HTTPS
    if (originalUrl.startsWith('https://')) {
      variations.push(originalUrl.replace('https://', 'http://'));
    }
    
    // Try .mp3 instead of .wav
    if (originalUrl.toLowerCase().endsWith('.wav')) {
      const mp3Url = originalUrl.replace(/\.wav$/i, '.mp3');
      variations.push(mp3Url);
      // Also try with /MP3/ folder
      variations.push(mp3Url.replace('/RECORDINGS/', '/RECORDINGS/MP3/'));
    }
    
    // Try without /MP3/ folder if present
    if (originalUrl.includes('/RECORDINGS/MP3/')) {
      variations.push(originalUrl.replace('/RECORDINGS/MP3/', '/RECORDINGS/'));
    }
    
    // Try with /MP3/ folder if not present
    if (originalUrl.includes('/RECORDINGS/') && !originalUrl.includes('/RECORDINGS/MP3/')) {
      const filename = originalUrl.split('/RECORDINGS/')[1];
      if (filename) {
        variations.push(`${baseUrl}/RECORDINGS/MP3/${filename}`);
      }
    }
  }
  
  // Construct URLs from timestamp and leadId if available
  if (timestamp && leadId) {
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
    
    // Try different folder and extension combinations
    variations.push(`${baseUrl}/RECORDINGS/MP3/${formattedDate}_${leadId}-all.mp3`);
    variations.push(`${baseUrl}/RECORDINGS/${formattedDate}_${leadId}-all.mp3`);
    variations.push(`${baseUrl}/RECORDINGS/${formattedDate}_${leadId}-all.wav`);
    variations.push(`${baseUrl}/RECORDINGS/MP3/${formattedDate}_${leadId}.mp3`);
    
    // Try /vicidial/ path
    variations.push(`${baseUrl}/vicidial/RECORDINGS/MP3/${formattedDate}_${leadId}-all.mp3`);
  }
  
  // Dedupe and return
  return [...new Set(variations)];
};

// Try to fetch a URL and return true if it exists
const checkUrlExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' }
    });
    return response.ok;
  } catch {
    return false;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get records that are still processing
    const { data: processingRecords, error: fetchError } = await supabase
      .from('call_records')
      .select('id, system_call_id, recording_url, user_id, lead_id, timestamp')
      .eq('is_processing', true)
      .limit(50);

    if (fetchError) {
      console.error('Error fetching processing records:', fetchError);
      throw fetchError;
    }

    if (!processingRecords || processingRecords.length === 0) {
      console.log('No processing records found');
      return new Response(
        JSON.stringify({ success: true, message: 'No records to retry', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${processingRecords.length} records to retry`);

    // Group records by user to fetch their integration settings
    const userIds = [...new Set(processingRecords.map(r => r.user_id).filter(Boolean))];
    
    const { data: integrations } = await supabase
      .from('dialer_integrations')
      .select('*')
      .in('user_id', userIds)
      .eq('dialer_type', 'vicidial')
      .eq('is_active', true);

    const integrationMap = new Map(integrations?.map(i => [i.user_id, i]) || []);
    
    let updatedCount = 0;
    let failedCount = 0;

    for (const record of processingRecords) {
      const integration = integrationMap.get(record.user_id);
      if (!integration) {
        console.log(`No integration found for user ${record.user_id}`);
        failedCount++;
        continue;
      }

      const { server_url } = integration;
      const baseUrl = server_url.replace(/\/+$/, '').split('/vicidial')[0];
      
      // Get URL variations to try
      const urlVariations = getUrlVariations(
        baseUrl, 
        record.recording_url || '', 
        record.system_call_id?.replace('VICI-', '') || '',
        record.lead_id,
        record.timestamp
      );

      console.log(`Trying ${urlVariations.length} URL variations for record ${record.id}`);

      let foundUrl: string | null = null;

      // Try each URL variation
      for (const url of urlVariations) {
        console.log(`Checking: ${url}`);
        const exists = await checkUrlExists(url);
        if (exists) {
          foundUrl = url;
          console.log(`Found working URL: ${url}`);
          break;
        }
      }

      if (foundUrl) {
        // Normalize to HTTP
        if (foundUrl.startsWith('https://')) {
          foundUrl = foundUrl.replace('https://', 'http://');
        }

        // Update the record with the working URL
        const { error: updateError } = await supabase
          .from('call_records')
          .update({
            recording_url: foundUrl,
            is_processing: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (!updateError) {
          updatedCount++;
          console.log(`Updated record ${record.id} with working URL: ${foundUrl}`);
          
          // Trigger transcription for this record
          fetch(`${supabaseUrl}/functions/v1/transcribe-background`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ record_id: record.id }),
          }).catch(err => console.error(`Failed to trigger transcription for ${record.id}:`, err));
        } else {
          console.error(`Failed to update record ${record.id}:`, updateError);
          failedCount++;
        }
      } else {
        console.log(`No working URL found for record ${record.id} - still processing`);
        failedCount++;
      }
    }

    console.log(`Retry complete: ${updatedCount} updated, ${failedCount} still processing`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Retried ${processingRecords.length} records`,
        updated: updatedCount,
        stillProcessing: failedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Retry-wav-recordings error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
