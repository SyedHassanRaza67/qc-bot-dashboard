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
      
      // Validate agent_user is required for recording_lookup
      if (!agent_user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Agent User is required for syncing recordings. Please configure it in Integrations settings.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Generate date range to sync (default last 7 days)
      const today = new Date();
      const defaultFromDate = new Date(today);
      defaultFromDate.setDate(today.getDate() - 7);
      
      const startDate = dateFrom || defaultFromDate.toISOString().split('T')[0];
      const endDate = dateTo || today.toISOString().split('T')[0];
      
      console.log(`Syncing recordings from ${startDate} to ${endDate}`);
      
      // Generate array of dates to sync
      const datesToSync: string[] = [];
      const current = new Date(startDate);
      const end = new Date(endDate);
      
      while (current <= end) {
        datesToSync.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      
      console.log('Dates to sync:', datesToSync);
      
      let allRecords: any[] = [];
      
      // Fetch recordings for each date
      for (const queryDate of datesToSync) {
        const recordingUrl = `${baseUrl}/vicidial/non_agent_api.php?source=AI-Analyzer&function=recording_lookup&stage=pipe&user=${api_user}&pass=${api_pass_encrypted}&agent_user=${agent_user}&date=${queryDate}&duration=Y`;
        
        console.log('Fetching recordings for date:', queryDate);

        try {
          const response = await fetch(recordingUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'AI-Audio-Analyzer/1.0' },
          });

          if (!response.ok) {
            console.log(`HTTP error for date ${queryDate}:`, response.status);
            continue;
          }

          const text = await response.text();
          console.log(`Response for ${queryDate} length:`, text.length);
          console.log(`Response for ${queryDate} preview:`, text.substring(0, 200));
          
          // Parse VICIdial pipe-delimited response
          const lines = text.trim().split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('ERROR') || line.startsWith('NOTICE')) {
              continue;
            }
            
            const parts = line.split('|');
            
            // VICIdial recording_lookup with stage=pipe returns pipe-delimited data
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
              
              allRecords.push({
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
                upload_source: 'dialer',
              });
            }
          }
        } catch (fetchError) {
          console.log(`Error fetching date ${queryDate}:`, fetchError);
          continue;
        }
      }
      
      console.log('Total records parsed:', allRecords.length);

      // Insert new records (check for duplicates manually since system_call_id may not have unique constraint)
      let insertedCount = 0;
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
        
        const { error: insertError } = await supabase
          .from('call_records')
          .insert(record);

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
          message: `Synced ${insertedCount} new records from ${datesToSync.length} days`,
          total: allRecords.length,
          inserted: insertedCount,
          dateRange: { from: startDate, to: endDate }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
