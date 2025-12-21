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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 10;

    console.log('Transcribe-pending called, limit:', limit);

    // Find pending records
    const { data: pendingRecords, error: fetchError } = await supabase
      .from('call_records')
      .select('id, recording_url, system_call_id')
      .or('summary.eq.Pending AI analysis,summary.ilike.Transcription failed%')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending records', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingRecords.length} records`);
    let successCount = 0;
    let failCount = 0;

    for (const record of pendingRecords) {
      try {
        if (!record.recording_url) {
          await supabase.from('call_records').update({ summary: 'No recording URL' }).eq('id', record.id);
          failCount++;
          continue;
        }

        // Mark as processing
        await supabase.from('call_records').update({ summary: 'Transcribing...' }).eq('id', record.id);

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

        // Call Lovable AI
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'Transcribe and analyze this call. Return JSON: {"transcript":"...", "status":"sale|callback|not-interested|disqualified|pending", "sub_disposition":"...", "summary":"...", "reason":"...", "agent_response":"excellent|good|average|bad|very-bad", "customer_response":"excellent|good|average|bad|very-bad"}'
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe and analyze:' },
                  { type: 'input_audio', input_audio: { data: base64Audio, format: 'mp3' } }
                ]
              }
            ],
          }),
        });

        if (!aiResponse.ok) throw new Error(`AI failed: ${aiResponse.status}`);

        const data = await aiResponse.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate and sanitize each field before database update
            await supabase.from('call_records').update({
              transcript: validateString(parsed.transcript, content),
              status: validateStatus(parsed.status),
              sub_disposition: validateString(parsed.sub_disposition, 'Analyzed'),
              summary: validateString(parsed.summary, 'Call analyzed'),
              reason: validateString(parsed.reason, 'See transcript'),
              agent_response: validateResponse(parsed.agent_response),
              customer_response: validateResponse(parsed.customer_response),
              updated_at: new Date().toISOString(),
            }).eq('id', record.id);
            
            console.log('AI response validated and saved for record:', record.id);
          } catch (parseError) {
            console.log('Parse error, saving raw transcript:', parseError);
            await supabase.from('call_records').update({
              transcript: content,
              summary: 'Transcription complete',
              updated_at: new Date().toISOString(),
            }).eq('id', record.id);
          }
        } else {
          await supabase.from('call_records').update({
            transcript: content,
            summary: 'Transcription complete',
            updated_at: new Date().toISOString(),
          }).eq('id', record.id);
        }

        successCount++;
        console.log(`Completed: ${record.system_call_id}`);
      } catch (err) {
        console.error(`Failed ${record.id}:`, err);
        await supabase.from('call_records').update({ summary: 'Transcription failed' }).eq('id', record.id);
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: pendingRecords.length, success_count: successCount, fail_count: failCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
