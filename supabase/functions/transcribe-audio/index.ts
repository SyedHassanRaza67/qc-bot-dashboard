import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid enum values for validation
const VALID_STATUSES = ['sale', 'callback', 'not-interested', 'disqualified', 'pending'] as const;
const VALID_RESPONSES = ['excellent', 'good', 'average', 'bad', 'very-bad'] as const;

type ValidStatus = typeof VALID_STATUSES[number];
type ValidResponse = typeof VALID_RESPONSES[number];

// Validation helper functions
function validateStatus(value: unknown): ValidStatus {
  if (typeof value === 'string' && VALID_STATUSES.includes(value as ValidStatus)) {
    return value as ValidStatus;
  }
  return 'pending';
}

function validateResponse(value: unknown): ValidResponse | null {
  if (typeof value === 'string' && VALID_RESPONSES.includes(value as ValidResponse)) {
    return value as ValidResponse;
  }
  return null;
}

function validateString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function validateNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { audio, fileName, metadata } = await req.json();
    if (!audio) throw new Error('No audio data provided');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upload to storage
    const fileExt = fileName.split('.').pop() || 'mp3';
    const storagePath = `${user.id}/${Date.now()}-${fileName}`;
    
    // Decode base64
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage.from('audio-recordings').upload(storagePath, bytes, {
      contentType: `audio/${fileExt === 'mp3' ? 'mpeg' : fileExt}`,
    });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Call AI for transcription
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Transcribe and analyze. Return JSON only: {"transcript":"...", "status":"sale|callback|not-interested|disqualified|pending", "agentName":"...", "subDisposition":"...", "reason":"...", "summary":"...", "campaignName":"...", "publisher":"...", "agent_response":"excellent|good|average|bad|very-bad", "customer_response":"excellent|good|average|bad|very-bad"}' },
          { role: 'user', content: [{ type: 'text', text: 'Analyze:' }, { type: 'image_url', image_url: { url: `data:audio/webm;base64,${audio}` } }] }
        ],
      }),
    });

    // Default safe values
    let analysis = {
      transcript: 'Transcription pending',
      status: 'pending' as ValidStatus,
      agentName: null as string | null,
      subDisposition: 'Uploaded',
      reason: 'Processing',
      summary: 'Audio uploaded',
      campaignName: 'General',
      publisher: 'Manual Upload',
      agent_response: null as ValidResponse | null,
      customer_response: null as ValidResponse | null,
    };

    if (aiResponse.ok) {
      const data = await aiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const parsed = JSON.parse(jsonStr);
        
        // Validate and sanitize each field
        analysis = {
          transcript: validateString(parsed.transcript, 'Transcription pending'),
          status: validateStatus(parsed.status),
          agentName: validateNullableString(parsed.agentName),
          subDisposition: validateString(parsed.subDisposition, 'Uploaded'),
          reason: validateString(parsed.reason, 'Processing'),
          summary: validateString(parsed.summary, 'Audio uploaded'),
          campaignName: validateString(parsed.campaignName, 'General'),
          publisher: validateString(parsed.publisher, 'Manual Upload'),
          agent_response: validateResponse(parsed.agent_response),
          customer_response: validateResponse(parsed.customer_response),
        };
        
        console.log('AI response validated successfully');
      } catch (e) {
        console.log('Parse error, using defaults:', e);
      }
    }

    // Insert record with validated data
    const { data: record, error: dbError } = await supabase.from('call_records').insert({
      user_id: user.id,
      caller_id: metadata?.callerId || '+1234567890',
      publisher: analysis.publisher,
      status: analysis.status,
      agent_name: analysis.agentName,
      sub_disposition: analysis.subDisposition,
      duration: metadata?.duration || '0:00',
      campaign_name: analysis.campaignName,
      reason: analysis.reason,
      summary: analysis.summary,
      system_call_id: `SYS-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      publisher_id: `PUB-${Math.random().toString(36).substring(7).toUpperCase()}`,
      buyer_id: `BUY-${Math.random().toString(36).substring(7).toUpperCase()}`,
      transcript: analysis.transcript,
      audio_file_name: fileName,
      recording_url: storagePath,
      upload_source: 'manual',
      agent_response: analysis.agent_response,
      customer_response: analysis.customer_response,
    }).select().single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    return new Response(JSON.stringify({ success: true, record, transcript: analysis.transcript, analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', success: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
