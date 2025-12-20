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
        // Test using the version function
        const testUrl = `${baseUrl}/vicidial/non_agent_api.php?source=test&user=${api_user}&pass=${api_pass_encrypted}&function=version`;
        
        console.log('Test URL:', testUrl.replace(api_pass_encrypted, '***'));

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
        } else {
          throw new Error('Invalid response from VICIdial API');
        }
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
      
      const today = new Date().toISOString().split('T')[0];
      const queryDate = dateFrom || today;
      
      // Build recording lookup URL with correct VICIdial API format
      // Format: /vicidial/non_agent_api.php?source=test&function=recording_lookup&stage=pipe&user=X&pass=X&agent_user=X&date=X&duration=Y
      let recordingUrl = `${baseUrl}/vicidial/non_agent_api.php?source=AI-Analyzer&function=recording_lookup&stage=pipe&user=${api_user}&pass=${api_pass_encrypted}&date=${queryDate}&duration=Y`;
      
      // Add agent_user filter if configured
      if (agent_user) {
        recordingUrl += `&agent_user=${agent_user}`;
      }
      
      console.log('Fetching recordings from:', recordingUrl.replace(api_pass_encrypted, '***'));

      try {
        const response = await fetch(recordingUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        console.log('Recording lookup response length:', text.length);
        console.log('Recording lookup response preview:', text.substring(0, 500));
        
        // Parse VICIdial pipe-delimited response
        // Format: recording_id|lead_id|list_id|campaign_id|call_date|start_epoch|end_epoch|length_in_sec|filename|location|user|...
        const lines = text.trim().split('\n');
        const records = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('ERROR') || line.startsWith('NOTICE')) {
            console.log('Skipping line:', line);
            continue;
          }
          
          const parts = line.split('|');
          console.log(`Line ${i} parts count:`, parts.length);
          
          // VICIdial recording_lookup with stage=pipe returns pipe-delimited data
          // Typical format: recording_id|lead_id|list_id|campaign_id|call_date|start_epoch|end_epoch|length_in_sec|filename|location|user
          if (parts.length >= 6) {
            const recordingId = parts[0]?.trim();
            const leadId = parts[1]?.trim();
            const callDate = parts[4]?.trim() || queryDate;
            const lengthInSec = parts[7]?.trim() || '0';
            const filename = parts[8]?.trim() || '';
            const location = parts[9]?.trim() || '';
            const agentUser = parts[10]?.trim() || agent_user || 'unknown';
            
            // Skip if no valid recording ID
            if (!recordingId || recordingId === '') continue;
            
            records.push({
              system_call_id: recordingId,
              caller_id: leadId || 'unknown',
              timestamp: callDate,
              duration: `${lengthInSec}s`,
              recording_url: location || filename,
              user_id: user.id,
              publisher_id: 'vicidial',
              buyer_id: leadId || 'unknown',
              publisher: 'VICIdial',
              campaign_name: 'VICIdial Import',
              status: 'pending_review',
              sub_disposition: 'Imported',
              reason: 'Auto-imported from VICIdial',
              summary: 'Pending AI analysis',
              transcript: 'Pending transcription',
              agent_name: agentUser,
              upload_source: 'dialer', // Mark as dialer synced
            });
          }
        }

        console.log('Parsed records:', records.length);

        // Insert new records (skip duplicates based on system_call_id)
        let insertedCount = 0;
        for (const record of records) {
          const { error: insertError } = await supabase
            .from('call_records')
            .upsert(record, { onConflict: 'system_call_id', ignoreDuplicates: true });

          if (!insertError) {
            insertedCount++;
          } else {
            console.log('Insert error for record:', record.system_call_id, insertError);
          }
        }

        // Update last sync timestamp
        await supabase
          .from('dialer_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Synced ${insertedCount} records`,
            total: records.length,
            inserted: insertedCount 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError) {
        console.error('VICIdial sync failed:', fetchError);
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        return new Response(
          JSON.stringify({ success: false, error: `Sync failed: ${errorMessage}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
