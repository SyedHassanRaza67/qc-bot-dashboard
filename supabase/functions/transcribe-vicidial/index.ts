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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log('Authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Authenticated user:', user.id);
    // ========== END AUTHENTICATION CHECK ==========

    const { call_record_id } = await req.json();
    if (!call_record_id) {
      return new Response(JSON.stringify({ error: 'call_record_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== OWNERSHIP VERIFICATION ==========
    // Verify the authenticated user owns this call record
    const { data: record, error: fetchError } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', call_record_id)
      .eq('user_id', user.id)  // Verify ownership
      .single();
      
    if (fetchError || !record) {
      console.log('Record not found or access denied for user:', user.id, 'record:', call_record_id);
      return new Response(
        JSON.stringify({ error: 'Call record not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== END OWNERSHIP VERIFICATION ==========

    if (!record.recording_url) {
      return new Response(JSON.stringify({ error: 'No recording URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Processing transcription for record:', call_record_id);

    // Fetch audio
    const audioResponse = await fetch(record.recording_url, { headers: { 'Accept': 'audio/*' } });
    if (!audioResponse.ok) throw new Error(`Audio fetch failed: ${audioResponse.status}`);

    const audioBuffer = await audioResponse.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    // Call AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Transcribe and analyze. Return JSON: {"transcript":"...", "status":"sale|callback|not-interested|disqualified|pending", "sub_disposition":"...", "summary":"...", "reason":"...", "agent_response":"excellent|good|average|bad|very-bad", "customer_response":"excellent|good|average|bad|very-bad"}' },
          { role: 'user', content: [{ type: 'text', text: 'Transcribe:' }, { type: 'image_url', image_url: { url: `data:audio/mpeg;base64,${base64Audio}` } }] }
        ],
      }),
    });

    if (!aiResponse.ok) throw new Error(`AI failed: ${aiResponse.status}`);

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    // Default safe values
    let result = {
      transcript: content,
      status: 'pending' as ValidStatus,
      sub_disposition: 'Analyzed',
      summary: 'Transcribed',
      reason: 'See transcript',
      agent_response: null as ValidResponse | null,
      customer_response: null as ValidResponse | null,
    };

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and sanitize each field
        result = {
          transcript: validateString(parsed.transcript, content),
          status: validateStatus(parsed.status),
          sub_disposition: validateString(parsed.sub_disposition, 'Analyzed'),
          summary: validateString(parsed.summary, 'Transcribed'),
          reason: validateString(parsed.reason, 'See transcript'),
          agent_response: validateResponse(parsed.agent_response),
          customer_response: validateResponse(parsed.customer_response),
        };
        
        console.log('AI response validated successfully');
      } catch (e) {
        console.log('Parse error, using defaults:', e);
      }
    }

    await supabase.from('call_records').update({
      transcript: result.transcript,
      status: result.status,
      sub_disposition: result.sub_disposition,
      summary: result.summary,
      reason: result.reason,
      agent_response: result.agent_response,
      customer_response: result.customer_response,
      updated_at: new Date().toISOString(),
    }).eq('id', call_record_id);

    console.log('Transcription completed for record:', call_record_id);
    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
