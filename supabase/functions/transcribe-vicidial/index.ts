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
    const { call_record_id } = await req.json();
    if (!call_record_id) {
      return new Response(JSON.stringify({ error: 'call_record_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: record, error: fetchError } = await supabase.from('call_records').select('*').eq('id', call_record_id).single();
    if (fetchError || !record) {
      return new Response(JSON.stringify({ error: 'Call record not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!record.recording_url) {
      return new Response(JSON.stringify({ error: 'No recording URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
    
    let result = { transcript: content, status: 'pending', sub_disposition: 'Analyzed', summary: 'Transcribed', reason: 'See transcript', agent_response: null, customer_response: null };
    if (jsonMatch) {
      try { result = { ...result, ...JSON.parse(jsonMatch[0]) }; } catch (e) {}
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

    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
