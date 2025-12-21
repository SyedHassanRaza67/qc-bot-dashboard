import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, dateFrom, dateTo } = await req.json();

    // Fetch user's VICIdial integration settings
    const { data: integration, error: integrationError } = await supabase
      .from('dialer_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('dialer_type', 'vicidial')
      .single();

    if (integrationError || !integration) {
      console.log('No VICIdial integration found for user:', user.id);
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
    
    // Clean server URL (remove trailing slashes and any existing paths)
    const baseUrl = server_url.replace(/\/+$/, '').split('/vicidial')[0];

    // Test connection action
    if (action === 'test') {
      console.log('Testing VICIdial connection to:', baseUrl);

      try {
        const testUrl = `${baseUrl}/vicidial/non_agent_api.php?source=test&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass_encrypted)}&function=version`;
        console.log('Test URL:', testUrl.replace(encodeURIComponent(api_pass_encrypted), '***'));

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        console.log('VICIdial test response:', text);

        // Check if response contains VERSION (success indicator)
        if (text.includes('VERSION:')) {
          return new Response(
            JSON.stringify({ success: true, message: 'Connection successful', response: text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw new Error('Invalid response from VICIdial API');
      } catch (fetchError) {
        console.error('VICIdial connection test failed:', fetchError);
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        return new Response(
          JSON.stringify({ success: false, error: `Connection failed: ${errorMessage}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Sync recordings action
    if (action === 'sync') {
      console.log('Syncing recordings from VICIdial');

      // Validate agent_user is required for recording_lookup
      if (!agent_user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Agent User is required for syncing recordings. Please configure it in Integrations settings.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Support multiple agent IDs (comma separated)
      const agentUsers = agent_user
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

      // Generate date range to sync (default last 7 days)
      const today = new Date();
      const defaultFromDate = new Date(today);
      defaultFromDate.setDate(today.getDate() - 7);

      const startDate = dateFrom || defaultFromDate.toISOString().split('T')[0];
      const endDate = dateTo || today.toISOString().split('T')[0];

      console.log(`Syncing recordings from ${startDate} to ${endDate} for agents:`, agentUsers);

      // Generate array of dates to sync
      const datesToSync: string[] = [];
      const current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        datesToSync.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      let allRecords: any[] = [];

      const isDateTime = (value: string) =>
        /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(value);

      const toIsoTimestamp = (startDateStr: string, fallbackDate: string) => {
        if (startDateStr && isDateTime(startDateStr)) {
          return new Date(startDateStr.replace(' ', 'T') + 'Z').toISOString();
        }
        return new Date(fallbackDate + 'T00:00:00Z').toISOString();
      };

      // Fetch recordings for each date + each agent
      for (const queryDate of datesToSync) {
        for (const agentId of agentUsers) {
          const recordingUrl = `${baseUrl}/vicidial/non_agent_api.php?source=AI-Analyzer&function=recording_lookup&stage=pipe&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass_encrypted)}&agent_user=${encodeURIComponent(agentId)}&date=${encodeURIComponent(queryDate)}&duration=Y`;

          console.log('Fetching recordings for date:', queryDate, 'agent:', agentId);

          try {
            const response = await fetch(recordingUrl, {
              method: 'GET',
              headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' },
            });

            if (!response.ok) {
              console.log(`HTTP error for date ${queryDate} agent ${agentId}:`, response.status);
              continue;
            }

            const text = await response.text();

            // Parse VICIdial pipe-delimited response
            const lines = text.trim().split('\n');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line || line.startsWith('ERROR') || line.startsWith('NOTICE') || line === 'NO RECORDINGS FOUND') {
                continue;
              }

              const parts = line.split('|').map((p) => p.trim());

              // Observed formats:
              // A) start_date|agent_user|lead_id|recording_id|length_in_sec|location
              // B) recording_id|lead_id|closecallid|list_id|start_epoch|start_date|end_epoch|length_in_sec|filename|location|user
              let startDateStr = '';
              let recordingId = '';
              let leadId = '';
              let lengthInSec = '0';
              let filename = '';
              let location = '';
              let agentFromLine = agentId;

              if (parts.length === 6 && isDateTime(parts[0] || '')) {
                startDateStr = parts[0] || '';
                agentFromLine = parts[1] || agentId;
                leadId = parts[2] || '';
                recordingId = parts[3] || '';
                lengthInSec = parts[4] || '0';
                location = parts[5] || '';
              } else if (parts.length >= 6) {
                recordingId = parts[0] || '';
                leadId = parts[1] || '';
                startDateStr = parts[5] || '';
                lengthInSec = parts[7] || '0';
                filename = parts[8] || '';
                location = parts[9] || '';
                agentFromLine = parts[10] || agentId;
              } else {
                continue;
              }

              // Must be numeric recording ID
              if (!recordingId || isNaN(Number(recordingId))) {
                continue;
              }

              const timestamp = toIsoTimestamp(startDateStr, queryDate);

              const durationSecs = parseInt(lengthInSec, 10) || 0;
              const mins = Math.floor(durationSecs / 60);
              const secs = durationSecs % 60;
              const durationFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

              allRecords.push({
                system_call_id: `VICI-${recordingId}`,
                caller_id: leadId || 'unknown',
                lead_id: leadId || null,
                timestamp,
                duration: durationFormatted,
                recording_url: location || filename || null,
                user_id: user.id,
                publisher_id: 'vicidial',
                buyer_id: leadId || 'unknown',
                publisher: 'VICIdial',
                campaign_name: 'VICIdial Import',
                status: 'pending',
                sub_disposition: 'Imported',
                reason: 'Auto-imported from VICIdial',
                summary: 'Pending AI analysis',
                transcript: 'Pending transcription',
                agent_name: agentFromLine,
                upload_source: 'vicidial',
              });
            }
          } catch (fetchError) {
            console.log(`Error fetching date ${queryDate} agent ${agentId}:`, fetchError);
            continue;
          }
        }
      }

      console.log('Total records parsed:', allRecords.length);

      // Insert new records (check for duplicates)
      let insertedCount = 0;
      const newRecordIds: string[] = [];
      
      for (const record of allRecords) {
        // Check if record already exists
        const { data: existing } = await supabase
          .from('call_records')
          .select('id')
          .eq('system_call_id', record.system_call_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          console.log('Skipping duplicate:', record.system_call_id);
          continue;
        }

        const { data: insertedRecord, error: insertError } = await supabase
          .from('call_records')
          .insert(record)
          .select('id')
          .single();

        if (!insertError && insertedRecord) {
          insertedCount++;
          newRecordIds.push(insertedRecord.id);
        } else {
          console.log('Insert error for record:', record.system_call_id, insertError);
        }
      }

      // Update last sync timestamp
      await supabase
        .from('dialer_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', integration.id);

      // Fire-and-forget: Trigger transcription without waiting (returns immediately)
      if (newRecordIds.length > 0) {
        console.log(`Triggering transcribe-pending for ${newRecordIds.length} new records (fire-and-forget)`);
        
        // Don't await - let it run in background
        fetch(`${supabaseUrl}/functions/v1/transcribe-pending`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ recordIds: newRecordIds }),
        }).catch(err => console.error('Transcription trigger error:', err));
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Synced ${insertedCount} new recordings out of ${allRecords.length} found`,
          total: allRecords.length,
          inserted: insertedCount,
          transcription_triggered: newRecordIds.length > 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Vici-sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});