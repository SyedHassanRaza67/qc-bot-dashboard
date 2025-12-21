import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        JSON.stringify({ success: false, error: 'AI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (optional - can be called by service role too)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body = await req.json().catch(() => ({}));
    const { recordIds, limit = 5 } = body;

    console.log('Transcribe-pending called with:', { userId, recordIds, limit });

    // Build query to find pending records
    let query = supabase
      .from('call_records')
      .select('*')
      .eq('summary', 'Pending AI analysis')
      .order('created_at', { ascending: true })
      .limit(limit);

    // If specific record IDs provided, use those
    if (recordIds && recordIds.length > 0) {
      query = supabase
        .from('call_records')
        .select('*')
        .in('id', recordIds)
        .eq('summary', 'Pending AI analysis');
    } else if (userId) {
      // Otherwise filter by user if authenticated
      query = query.eq('user_id', userId);
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
        JSON.stringify({ success: true, message: 'No pending records to transcribe', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingRecords.length} pending records to transcribe`);

    let successCount = 0;
    let failCount = 0;

    for (const record of pendingRecords) {
      try {
        console.log(`Processing record: ${record.id}`);

        // Mark as transcribing immediately
        await supabase
          .from('call_records')
          .update({ summary: 'Transcribing...' })
          .eq('id', record.id);

        if (!record.recording_url) {
          console.log(`No recording URL for ${record.id}`);
          await supabase
            .from('call_records')
            .update({ summary: 'No recording URL available' })
            .eq('id', record.id);
          failCount++;
          continue;
        }

        // Fetch the audio file
        console.log(`Fetching audio from: ${record.recording_url}`);
        const audioResponse = await fetch(record.recording_url, {
          headers: { 'Accept': 'audio/*' },
        });

        if (!audioResponse.ok) {
          console.log(`Failed to fetch audio for ${record.id}: ${audioResponse.status}`);
          await supabase
            .from('call_records')
            .update({ summary: `Audio fetch failed: ${audioResponse.status}` })
            .eq('id', record.id);
          failCount++;
          continue;
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        console.log(`Audio fetched for ${record.id}, size: ${audioBuffer.byteLength} bytes`);

        // Convert to base64 in chunks
        let binaryString = '';
        const chunkSize = 8192;
        const audioBytes = new Uint8Array(audioBuffer);
        for (let i = 0; i < audioBytes.length; i += chunkSize) {
          const chunk = audioBytes.subarray(i, Math.min(i + chunkSize, audioBytes.length));
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const audioBase64 = btoa(binaryString);

        // Call Lovable AI for transcription
        const systemPrompt = `You are an expert call center quality analyst. Analyze this call recording and provide:
1. Complete transcript formatted as: Agent: [text]
Customer: [text]
2. AI disposition (status): sale, callback, not-interested, disqualified, or pending
3. Sub-disposition with detail
4. Brief summary (2-3 sentences)
5. Main reason for outcome
6. Agent sentiment: excellent, good, average, bad, or very-bad
7. Customer sentiment: excellent, good, average, bad, or very-bad

Respond in JSON format only:
{"transcript":"...","status":"...","sub_disposition":"...","summary":"...","reason":"...","agent_response":"...","customer_response":"..."}`;

        console.log(`Calling AI for record: ${record.id}`);
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe and analyze this call recording. Respond with JSON only.' },
                  { type: 'image_url', image_url: { url: `data:audio/mpeg;base64,${audioBase64}` } }
                ]
              }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI error for ${record.id}: ${aiResponse.status} - ${errorText}`);
          await supabase
            .from('call_records')
            .update({ summary: `AI error: ${aiResponse.status}` })
            .eq('id', record.id);
          
          // Wait if rate limited
          if (aiResponse.status === 429) {
            console.log('Rate limited, waiting 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
          failCount++;
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        console.log(`AI response for ${record.id}:`, content.substring(0, 200));

        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          await supabase
            .from('call_records')
            .update({
              transcript: result.transcript || 'Transcription unavailable',
              status: result.status || 'pending',
              sub_disposition: result.sub_disposition || 'Analyzed',
              summary: result.summary || 'Analysis complete',
              reason: result.reason || 'See transcript',
              agent_response: result.agent_response || null,
              customer_response: result.customer_response || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          console.log(`Transcription completed for ${record.id}`);
          successCount++;
        } else {
          console.log(`No JSON found in AI response for ${record.id}`);
          await supabase
            .from('call_records')
            .update({ summary: 'AI response parsing failed' })
            .eq('id', record.id);
          failCount++;
        }

        // Delay between records to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        console.error(`Error processing record ${record.id}:`, err);
        await supabase
          .from('call_records')
          .update({ summary: `Processing error: ${err instanceof Error ? err.message : 'Unknown'}` })
          .eq('id', record.id);
        failCount++;
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
