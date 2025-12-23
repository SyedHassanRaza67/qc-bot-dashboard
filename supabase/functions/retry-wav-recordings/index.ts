import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get records that are still processing (have .wav files)
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

    console.log(`Found ${processingRecords.length} records to retry for mp3 conversion`);

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
        continue;
      }

      const { server_url, api_user, api_pass_encrypted } = integration;
      const baseUrl = server_url.replace(/\/+$/, '').split('/vicidial')[0];
      
      // Extract recording ID from system_call_id (format: VICI-{recordingId})
      const recordingId = record.system_call_id?.replace('VICI-', '');
      if (!recordingId) {
        console.log(`Invalid system_call_id for record ${record.id}`);
        continue;
      }

      // Query VICIdial API again to get updated recording info
      const queryDate = record.timestamp ? new Date(record.timestamp).toISOString().split('T')[0] : null;
      if (!queryDate) continue;

      try {
        // Try to fetch recording info from API
        const url = `${baseUrl}/vicidial/non_agent_api.php?source=AI-Analyzer&function=recording_lookup&stage=pipe&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass_encrypted)}&recording_id=${encodeURIComponent(recordingId)}`;
        
        console.log(`Retrying API call for recording ${recordingId}`);
        const response = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' } });
        
        if (!response.ok) {
          console.log(`API call failed for ${recordingId}: HTTP ${response.status}`);
          failedCount++;
          continue;
        }

        const text = await response.text();
        console.log(`API response for ${recordingId}: ${text.substring(0, 200)}`);

        // Parse response to find mp3 URL
        let newRecordingUrl: string | null = null;
        
        const lines = text.trim().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('ERROR') || trimmed === 'NO RECORDINGS FOUND') continue;
          
          const parts = trimmed.split('|').map(p => p.trim());
          
          // Look for location field that contains mp3
          for (const part of parts) {
            if (part.toLowerCase().includes('.mp3')) {
              if (part.startsWith('http')) {
                newRecordingUrl = part;
              } else if (part.startsWith('/')) {
                newRecordingUrl = `${baseUrl}${part}`;
              } else if (part.length > 5) {
                newRecordingUrl = `${baseUrl}/RECORDINGS/MP3/${part}`;
              }
              break;
            }
          }
          if (newRecordingUrl) break;
        }

        // If we found an mp3 URL, update the record
        if (newRecordingUrl && newRecordingUrl.toLowerCase().includes('.mp3')) {
          // Normalize to HTTP
          if (newRecordingUrl.startsWith('https://')) {
            newRecordingUrl = newRecordingUrl.replace('https://', 'http://');
          }

          console.log(`Found mp3 URL for ${recordingId}: ${newRecordingUrl}`);
          
          const { error: updateError } = await supabase
            .from('call_records')
            .update({
              recording_url: newRecordingUrl,
              is_processing: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);

          if (!updateError) {
            updatedCount++;
            console.log(`Updated record ${record.id} with mp3 URL`);
            
            // Trigger transcription for this record
            fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ recordId: record.id }),
            }).catch(err => console.error(`Failed to trigger transcription for ${record.id}:`, err));
          } else {
            console.error(`Failed to update record ${record.id}:`, updateError);
            failedCount++;
          }
        } else {
          // Still no mp3, try constructing URL directly
          const wavUrl = record.recording_url;
          if (wavUrl) {
            const mp3Url = wavUrl.replace(/\.wav$/i, '.mp3').replace('/RECORDINGS/', '/RECORDINGS/MP3/');
            
            // Try to verify the mp3 exists
            try {
              const headResponse = await fetch(mp3Url, { method: 'HEAD' });
              if (headResponse.ok) {
                console.log(`Found mp3 at constructed URL for ${recordingId}: ${mp3Url}`);
                
                const { error: updateError } = await supabase
                  .from('call_records')
                  .update({
                    recording_url: mp3Url,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', record.id);

                if (!updateError) {
                  updatedCount++;
                  
                  // Trigger transcription
                  fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({ recordId: record.id }),
                  }).catch(err => console.error(`Failed to trigger transcription for ${record.id}:`, err));
                }
              } else {
                console.log(`MP3 not yet available for ${recordingId} (still processing)`);
                failedCount++;
              }
            } catch {
              console.log(`Could not verify mp3 for ${recordingId}`);
              failedCount++;
            }
          } else {
            failedCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
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
