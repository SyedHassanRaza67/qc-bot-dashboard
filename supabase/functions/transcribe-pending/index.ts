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

// Process a single record
async function processRecord(
  record: any, 
  supabase: any, 
  lovableKey: string
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    console.log(`Processing record: ${record.id}`);
    
    // Mark as transcribing
    await supabase
      .from('call_records')
      .update({ summary: 'Transcribing...' })
      .eq('id', record.id);

    if (!record.recording_url) {
      await supabase
        .from('call_records')
        .update({ summary: 'No recording URL' })
        .eq('id', record.id);
      return { success: false, id: record.id, error: 'No recording URL' };
    }

    // Transcribe with Lovable AI
    const result = await transcribeWithLovableAI(record.recording_url, lovableKey);
    
    if (!result.transcript || result.transcript.trim().length === 0) {
      await supabase
        .from('call_records')
        .update({ 
          summary: 'Empty transcription',
          transcript: 'No speech detected in audio'
        })
        .eq('id', record.id);
      return { success: false, id: record.id, error: 'Empty transcription' };
    }

    // Update record with results
    await supabase
      .from('call_records')
      .update({
        transcript: result.transcript,
        status: result.analysis.status,
        sub_disposition: result.analysis.sub_disposition,
        summary: result.analysis.summary,
        reason: result.analysis.reason,
        agent_response: result.analysis.agent_response,
        customer_response: result.analysis.customer_response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    console.log(`Record ${record.id} completed successfully`);
    return { success: true, id: record.id };
    
  } catch (error) {
    console.error(`Error processing ${record.id}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase
      .from('call_records')
      .update({ summary: `Error: ${errorMsg.substring(0, 100)}` })
      .eq('id', record.id);
    
    return { success: false, id: record.id, error: errorMsg };
  }
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
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { recordIds, limit = 10 } = body;

    console.log('Transcribe-pending called with:', { recordIds, limit });

    // Build query to find pending records
    let query = supabase
      .from('call_records')
      .select('*')
      .or('summary.eq.Pending AI analysis,summary.eq.Transcribing...,summary.ilike.Transcription failed%')
      .order('created_at', { ascending: true })
      .limit(limit);

    // If specific record IDs provided, use those
    if (recordIds && recordIds.length > 0) {
      query = supabase
        .from('call_records')
        .select('*')
        .in('id', recordIds)
        .or('summary.eq.Pending AI analysis,summary.eq.Transcribing...,summary.ilike.Transcription failed%');
    }

    const { data: pendingRecords, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching pending records:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      console.log('No pending records found');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending records', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingRecords.length} pending records - processing in parallel`);

    // Process records in parallel (3 at a time to avoid rate limits)
    const BATCH_SIZE = 3;
    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (let i = 0; i < pendingRecords.length; i += BATCH_SIZE) {
      const batch = pendingRecords.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} records`);
      
      const batchResults = await Promise.allSettled(
        batch.map(record => 
          processRecord(record, supabase, LOVABLE_API_KEY)
        )
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
          results.push({ success: false, error: result.reason?.message });
        }
      }
    }

    console.log(`Transcription complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${pendingRecords.length} records`,
        processed: pendingRecords.length,
        success_count: successCount,
        fail_count: failCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcribe-pending error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
