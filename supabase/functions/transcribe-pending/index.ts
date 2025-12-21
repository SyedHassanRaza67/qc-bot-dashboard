import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Transcribe audio using OpenAI Whisper API (FAST!)
async function transcribeWithWhisper(audioUrl: string, openaiKey: string): Promise<string> {
  console.log('Fetching audio from:', audioUrl);
  
  const audioResponse = await fetch(audioUrl, {
    headers: { 'Accept': 'audio/*' },
  });
  
  if (!audioResponse.ok) {
    throw new Error(`Audio fetch failed: ${audioResponse.status}`);
  }
  
  const audioBlob = await audioResponse.blob();
  console.log('Audio fetched, size:', audioBlob.size, 'bytes');
  
  // Create form data for Whisper API
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'text');
  
  console.log('Calling Whisper API...');
  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    body: formData,
  });
  
  if (!whisperResponse.ok) {
    const errorText = await whisperResponse.text();
    throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`);
  }
  
  const transcript = await whisperResponse.text();
  console.log('Whisper transcription complete, length:', transcript.length);
  return transcript;
}

// Quick AI analysis of transcript using Lovable AI
async function analyzeTranscript(transcript: string, lovableKey: string): Promise<any> {
  const systemPrompt = `You are a call center analyst. Analyze this call transcript and provide:
- status: sale, callback, not-interested, disqualified, or pending
- sub_disposition: brief detail
- summary: 1-2 sentence summary
- reason: main reason for outcome
- agent_response: excellent, good, average, bad, or very-bad
- customer_response: excellent, good, average, bad, or very-bad

Respond in JSON only: {"status":"...","sub_disposition":"...","summary":"...","reason":"...","agent_response":"...","customer_response":"..."}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite', // Fast model for analysis
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this call transcript:\n\n${transcript}` }
      ],
    }),
  });

  if (!response.ok) {
    console.error('Analysis API error:', response.status);
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return null;
}

// Process a single record
async function processRecord(
  record: any, 
  supabase: any, 
  openaiKey: string, 
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

    // Step 1: Transcribe with Whisper (FAST - 2-5 seconds)
    const transcript = await transcribeWithWhisper(record.recording_url, openaiKey);
    
    if (!transcript || transcript.trim().length === 0) {
      await supabase
        .from('call_records')
        .update({ 
          summary: 'Empty transcription',
          transcript: 'No speech detected in audio'
        })
        .eq('id', record.id);
      return { success: false, id: record.id, error: 'Empty transcription' };
    }

    // Step 2: Analyze transcript with AI (optional, can be quick)
    const analysis = await analyzeTranscript(transcript, lovableKey);
    
    // Update record with results
    await supabase
      .from('call_records')
      .update({
        transcript: transcript,
        status: analysis?.status || 'pending',
        sub_disposition: analysis?.sub_disposition || 'Transcribed',
        summary: analysis?.summary || 'Transcription complete',
        reason: analysis?.reason || 'See transcript',
        agent_response: analysis?.agent_response || null,
        customer_response: analysis?.customer_response || null,
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { recordIds, limit = 10 } = body; // Increased limit for parallel processing

    console.log('Transcribe-pending called with:', { recordIds, limit });

    // Build query to find pending records
    let query = supabase
      .from('call_records')
      .select('*')
      .or('summary.eq.Pending AI analysis,summary.eq.Transcribing...')
      .order('created_at', { ascending: true })
      .limit(limit);

    // If specific record IDs provided, use those
    if (recordIds && recordIds.length > 0) {
      query = supabase
        .from('call_records')
        .select('*')
        .in('id', recordIds)
        .or('summary.eq.Pending AI analysis,summary.eq.Transcribing...');
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

    // Process records in parallel (5 at a time for speed)
    const BATCH_SIZE = 5;
    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (let i = 0; i < pendingRecords.length; i += BATCH_SIZE) {
      const batch = pendingRecords.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} records`);
      
      const batchResults = await Promise.allSettled(
        batch.map(record => 
          processRecord(record, supabase, OPENAI_API_KEY, LOVABLE_API_KEY || '')
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
