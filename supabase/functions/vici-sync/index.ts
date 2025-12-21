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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    
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

      // Fetch recordings
      for (const queryDate of datesToSync) {
        for (const agentId of agentUsers) {
          try {
            const url = `${baseUrl}/vicidial/non_agent_api.php?source=AI-Analyzer&function=recording_lookup&stage=pipe&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass_encrypted)}&agent_user=${encodeURIComponent(agentId)}&date=${encodeURIComponent(queryDate)}&duration=Y`;
            const response = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' } });
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('ERROR') || trimmed.startsWith('NOTICE') || trimmed === 'NO RECORDINGS FOUND') continue;

              const parts = trimmed.split('|').map(p => p.trim());
              let startDateStr = '', recordingId = '', leadId = '', lengthInSec = '0', location = '', agentFromLine = agentId;

              if (parts.length === 6 && isDateTime(parts[0])) {
                [startDateStr, agentFromLine, leadId, recordingId, lengthInSec, location] = parts;
              } else if (parts.length >= 6) {
                recordingId = parts[0]; leadId = parts[1]; startDateStr = parts[5];
                lengthInSec = parts[7] || '0'; location = parts[9] || ''; agentFromLine = parts[10] || agentId;
              } else continue;

              if (!recordingId || isNaN(Number(recordingId))) continue;

              const durationSecs = parseInt(lengthInSec, 10) || 0;
              const mins = Math.floor(durationSecs / 60);
              const secs = durationSecs % 60;

              allRecords.push({
                system_call_id: `VICI-${recordingId}`,
                caller_id: leadId || 'unknown',
                lead_id: leadId || null,
                timestamp: toIso(startDateStr, queryDate),
                duration: `${mins}:${secs.toString().padStart(2, '0')}`,
                recording_url: location || null,
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

      // Filter duplicates
      const newRecords: any[] = [];
      for (const record of allRecords) {
        const { data: existing } = await supabase.from('call_records').select('id').eq('system_call_id', record.system_call_id).eq('user_id', user.id).maybeSingle();
        if (!existing) newRecords.push(record);
      }

      console.log('New records:', newRecords.length);

      // Insert with pending status (transcription will happen separately)
      let insertedCount = 0;
      for (const record of newRecords) {
        const { error } = await supabase.from('call_records').insert({
          ...record,
          transcript: 'Pending transcription',
          status: 'pending',
          sub_disposition: 'Imported',
          summary: 'Pending AI analysis',
          reason: 'Auto-imported from VICIdial',
        });
        if (!error) insertedCount++;
      }

      // Update last sync
      await supabase.from('dialer_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id);

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${insertedCount} recordings`, total: allRecords.length, inserted: insertedCount }),
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
