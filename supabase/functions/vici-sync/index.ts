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

    const { server_url, api_user, api_pass_encrypted } = integration;

    // Test connection action
    if (action === 'test') {
      console.log('Testing VICIdial connection to:', server_url);
      
      try {
        // Try to ping the VICIdial API
        const testUrl = `${server_url}/vicidial/non_agent_api.php?source=test&user=${api_user}&pass=${api_pass_encrypted}&function=version`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        console.log('VICIdial test response:', text);

        return new Response(
          JSON.stringify({ success: true, message: 'Connection successful', response: text }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      
      // Build recording lookup URL
      const recordingUrl = `${server_url}/vicidial/non_agent_api.php?source=AI-Analyzer&user=${api_user}&pass=${api_pass_encrypted}&function=recording_lookup&date=${queryDate}&header=YES`;
      
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
        
        // Parse VICIdial response (pipe-delimited format)
        const lines = text.trim().split('\n');
        const records = [];
        
        // Skip header line if present
        const startIndex = lines[0]?.includes('recording_id') ? 1 : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split('|');
          if (parts.length >= 8) {
            // VICIdial format: recording_id|lead_id|date|start_time|end_time|length|phone|location
            const [recordingId, leadId, date, startTime, endTime, length, phone, location] = parts;
            
            records.push({
              system_call_id: recordingId,
              caller_id: phone,
              timestamp: `${date} ${startTime}`,
              duration: length,
              recording_url: location,
              user_id: user.id,
              // Default values for required fields
              publisher_id: 'vicidial',
              buyer_id: leadId || 'unknown',
              publisher: 'VICIdial',
              campaign_name: 'VICIdial Import',
              status: 'pending_review',
              sub_disposition: 'Imported',
              reason: 'Auto-imported from VICIdial',
              summary: 'Pending AI analysis',
              transcript: 'Pending transcription',
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
