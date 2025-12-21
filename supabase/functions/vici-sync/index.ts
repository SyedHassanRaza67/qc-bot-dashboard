import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Transcribe audio using Lovable AI (Google Gemini with audio support)
async function transcribeWithLovableAI(audioUrl: string, lovableKey: string): Promise<{ transcript: string; analysis: any }> {
  console.log('Fetching audio for transcription:', audioUrl);
  
  // Fetch audio file and convert to base64
  const audioResponse = await fetch(audioUrl, {
    headers: { 'Accept': 'audio/*' },
  });
  
  if (!audioResponse.ok) {
    throw new Error(`Audio fetch failed: ${audioResponse.status}`);
  }
  
  const audioBuffer = await audioResponse.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
  const mimeType = audioResponse.headers.get('content-type') || 'audio/mpeg';
  
  console.log('Audio fetched, size:', audioBuffer.byteLength, 'bytes, type:', mimeType);
  
  // Use Gemini with inline audio data for transcription + analysis in one call
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a call transcription and analysis expert. Listen to this audio and:
1. Transcribe the entire conversation word-for-word
2. Analyze the call and provide:
   - status: sale, callback, not-interested, disqualified, or pending
   - sub_disposition: brief detail about outcome
   - summary: 1-2 sentence summary
   - reason: main reason for outcome
   - agent_response: excellent, good, average, bad, or very-bad
   - customer_response: excellent, good, average, bad, or very-bad

Respond in this EXACT JSON format:
{
  "transcript": "Full word-for-word transcription here...",
  "status": "sale|callback|not-interested|disqualified|pending",
  "sub_disposition": "Brief detail",
  "summary": "1-2 sentence summary",
  "reason": "Main reason",
  "agent_response": "excellent|good|average|bad|very-bad",
  "customer_response": "excellent|good|average|bad|very-bad"
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please transcribe and analyze this call recording:'
            },
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio,
                format: mimeType.includes('wav') ? 'wav' : 'mp3'
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    throw new Error(`AI transcription failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('AI response received, length:', content.length);
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        transcript: parsed.transcript || 'No transcript available',
        analysis: {
          status: parsed.status || 'pending',
          sub_disposition: parsed.sub_disposition || 'Analyzed',
          summary: parsed.summary || 'Call analyzed',
          reason: parsed.reason || 'See transcript',
          agent_response: parsed.agent_response || null,
          customer_response: parsed.customer_response || null,
        }
      };
    } catch (e) {
      console.log('JSON parse failed, using raw content as transcript');
    }
  }
  
  // Fallback: use content as transcript
  return {
    transcript: content || 'Transcription failed',
    analysis: {
      status: 'pending',
      sub_disposition: 'Transcribed',
      summary: 'Transcription complete',
      reason: 'See transcript',
      agent_response: null,
      customer_response: null,
    }
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }
    
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

    // Sync recordings action - NOW WITH INLINE TRANSCRIPTION
    if (action === 'sync') {
      console.log('Syncing recordings from VICIdial WITH INLINE TRANSCRIPTION');

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

      // Filter out duplicates first
      const newRecords: any[] = [];
      for (const record of allRecords) {
        const { data: existing } = await supabase
          .from('call_records')
          .select('id')
          .eq('system_call_id', record.system_call_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existing) {
          newRecords.push(record);
        } else {
          console.log('Skipping duplicate:', record.system_call_id);
        }
      }

      console.log('New records to process:', newRecords.length);

      // Process each new record WITH INLINE TRANSCRIPTION
      let insertedCount = 0;
      let transcribedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i];
        console.log(`Processing ${i + 1}/${newRecords.length}: ${record.system_call_id}`);

        let transcript = 'Pending transcription';
        let status = 'pending';
        let sub_disposition = 'Imported';
        let summary = 'Pending AI analysis';
        let reason = 'Auto-imported from VICIdial';
        let agent_response = null;
        let customer_response = null;

        // Transcribe BEFORE inserting if we have a recording URL
        if (record.recording_url) {
          try {
            console.log(`Transcribing: ${record.recording_url}`);
            const result = await transcribeWithLovableAI(record.recording_url, LOVABLE_API_KEY);
            
            transcript = result.transcript;
            status = result.analysis.status;
            sub_disposition = result.analysis.sub_disposition;
            summary = result.analysis.summary;
            reason = result.analysis.reason;
            agent_response = result.analysis.agent_response;
            customer_response = result.analysis.customer_response;
            
            transcribedCount++;
            console.log(`Transcription complete for ${record.system_call_id}`);
          } catch (transcribeError) {
            console.error(`Transcription failed for ${record.system_call_id}:`, transcribeError);
            summary = 'Transcription failed - will retry';
            failedCount++;
          }
        }

        // Insert record with transcription data
        const { error: insertError } = await supabase
          .from('call_records')
          .insert({
            ...record,
            transcript,
            status,
            sub_disposition,
            summary,
            reason,
            agent_response,
            customer_response,
          });

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
          message: `Synced ${insertedCount} recordings (${transcribedCount} transcribed, ${failedCount} failed)`,
          total: allRecords.length,
          inserted: insertedCount,
          transcribed: transcribedCount,
          failed: failedCount,
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
