import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_STATUSES = ['sale', 'callback', 'not-interested', 'disqualified', 'pending'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { action, dateFrom, dateTo } = await req.json();

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('dialer_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('dialer_type', 'vicidial')
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ success: false, error: 'No VICIdial integration configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integration is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { server_url, api_user, api_pass_encrypted, agent_user } = integration;
    const baseUrl = server_url.replace(/\/+$/, '').split('/vicidial')[0];

    // Test connection
    if (action === 'test') {
      const testUrl = `${baseUrl}/vicidial/non_agent_api.php?source=test&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass_encrypted)}&function=version`;
      const response = await fetch(testUrl, { method: 'GET', headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' } });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      
      if (text.includes('VERSION:')) {
        return new Response(JSON.stringify({ success: true, message: 'Connection successful' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error('Invalid response from VICIdial API');
    }

    // Sync recordings
    if (action === 'sync') {
      if (!agent_user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Agent User is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const agentUsers = agent_user.split(',').map((s: string) => s.trim()).filter(Boolean);
      const today = new Date();
      const defaultFromDate = new Date(today);
      defaultFromDate.setDate(today.getDate() - 7);

      const startDate = dateFrom || defaultFromDate.toISOString().split('T')[0];
      const endDate = dateTo || today.toISOString().split('T')[0];

      // Generate dates
      const datesToSync: string[] = [];
      const current = new Date(startDate);
      const end = new Date(endDate);
      while (current <= end) {
        datesToSync.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      let allRecords: any[] = [];
      const isDateTime = (v: string) => /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(v);
      const toIso = (s: string, d: string) => isDateTime(s) ? new Date(s.replace(' ', 'T') + 'Z').toISOString() : new Date(d + 'T00:00:00Z').toISOString();

      console.log(`Starting sync for dates: ${startDate} to ${endDate}, agents: ${agentUsers.join(', ')}`);
      
      // Fetch all recordings from VICIdial
      for (const queryDate of datesToSync) {
        for (const agentId of agentUsers) {
          try {
            const url = `${baseUrl}/vicidial/non_agent_api.php?source=AI-Analyzer&function=recording_lookup&stage=pipe&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass_encrypted)}&agent_user=${encodeURIComponent(agentId)}&date=${encodeURIComponent(queryDate)}&duration=Y`;
            
            const response = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' } });
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split('\n');
            
            // Debug: Log first few raw API response lines
            if (lines.length > 0 && lines[0] !== 'NO RECORDINGS FOUND') {
              console.log(`Raw API response for agent ${agentId} on ${queryDate} (first 3 lines):`, lines.slice(0, 3));
            }

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('ERROR') || trimmed.startsWith('NOTICE') || trimmed === 'NO RECORDINGS FOUND') continue;

              const parts = trimmed.split('|').map(p => p.trim());
              let startDateStr = '', recordingId = '', leadId = '', lengthInSec = '0', location = '', agentFromLine = agentId;
              let filename = '';

              if (parts.length === 6 && isDateTime(parts[0])) {
                [startDateStr, agentFromLine, leadId, recordingId, lengthInSec, location] = parts;
              } else if (parts.length >= 6) {
                recordingId = parts[0]; leadId = parts[1]; startDateStr = parts[5];
                lengthInSec = parts[7] || '0'; location = parts[9] || ''; agentFromLine = parts[10] || agentId;
                filename = parts[4] || ''; // filename is usually at position 4
              } else continue;

              if (!recordingId || isNaN(Number(recordingId))) continue;

              const durationSecs = parseInt(lengthInSec, 10) || 0;
              const mins = Math.floor(durationSecs / 60);
              const secs = durationSecs % 60;

              // Build recording URL if not provided but we have the filename or can construct it
              let recordingUrl = location || null;
              
              // Normalize existing URL: convert /RECORDINGS/*.wav to /RECORDINGS/MP3/*.mp3
              if (recordingUrl && recordingUrl.includes('/RECORDINGS/') && !recordingUrl.includes('/MP3/')) {
                recordingUrl = recordingUrl
                  .replace('/RECORDINGS/', '/RECORDINGS/MP3/')
                  .replace('.wav', '.mp3');
                console.log('Normalized recording URL:', recordingUrl);
              }
              
              if (!recordingUrl && filename) {
                // Try to construct URL from filename - common VICIdial pattern
                recordingUrl = `${baseUrl}/RECORDINGS/MP3/${filename}.mp3`;
              } else if (!recordingUrl && startDateStr && leadId) {
                // Try to construct from timestamp and lead_id - common VICIdial naming pattern
                // Format: YYYYMMDD-HHMMSS_LEADID-all.mp3
                const dateMatch = startDateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                if (dateMatch) {
                  const formattedDate = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}-${dateMatch[4]}${dateMatch[5]}${dateMatch[6]}`;
                  recordingUrl = `${baseUrl}/RECORDINGS/MP3/${formattedDate}_${leadId}-all.mp3`;
                }
              }

              allRecords.push({
                system_call_id: `VICI-${recordingId}`,
                caller_id: leadId || 'unknown',
                lead_id: leadId || null,
                timestamp: toIso(startDateStr, queryDate),
                duration: `${mins}:${secs.toString().padStart(2, '0')}`,
                recording_url: recordingUrl,
                user_id: user.id,
                publisher_id: 'vicidial',
                buyer_id: leadId || 'unknown',
                publisher: 'VICIdial',
                campaign_name: 'VICIdial Import',
                agent_name: agentFromLine,
                upload_source: 'vicidial',
              });
            }
          } catch (e) { console.log('Fetch error:', e); }
        }
      }

      console.log('Total parsed:', allRecords.length);

      if (allRecords.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No recordings found for the selected date range', total: 0, inserted: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // BATCH duplicate check - get all existing system_call_ids in one query
      const systemCallIds = allRecords.map(r => r.system_call_id);
      const { data: existingRecords } = await supabase
        .from('call_records')
        .select('system_call_id')
        .eq('user_id', user.id)
        .in('system_call_id', systemCallIds);

      const existingIds = new Set(existingRecords?.map(r => r.system_call_id) || []);
      const newRecords = allRecords.filter(r => !existingIds.has(r.system_call_id));

      console.log('New records after batch filter:', newRecords.length);

      if (newRecords.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'All recordings already synced', total: allRecords.length, inserted: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // BATCH insert - insert all records at once in chunks of 100
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      const validatedStatus: ValidStatus = 'pending';

      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = newRecords.slice(i, i + BATCH_SIZE).map(record => ({
          ...record,
          transcript: 'Pending transcription',
          status: validatedStatus,
          sub_disposition: 'Imported',
          summary: 'Pending AI analysis',
          reason: 'Auto-imported from VICIdial',
        }));

        const { error, data } = await supabase.from('call_records').insert(batch).select('id');
        if (!error && data) {
          insertedCount += data.length;
        } else if (error) {
          console.log('Batch insert error:', error.message);
        }
      }

      // Update last sync
      await supabase.from('dialer_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id);

      console.log(`Sync complete: ${insertedCount} inserted out of ${allRecords.length} total`);

      // Auto-trigger background transcription if we inserted new records
      if (insertedCount > 0) {
        console.log('Triggering background transcription for new records...');
        // Use the user's original token to call the transcribe-background function
        // This ensures proper authentication since transcribe-background now requires JWT
        const userToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
        fetch(`${supabaseUrl}/functions/v1/transcribe-background`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ limit: insertedCount, concurrency: 5 }),
        }).catch(err => console.error('Background transcription trigger failed:', err));
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${insertedCount} new recordings`, total: allRecords.length, inserted: insertedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

  } catch (error) {
    console.error('Vici-sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
