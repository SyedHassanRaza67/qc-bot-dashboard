import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { call_record_id } = await req.json();

    if (!call_record_id) {
      return new Response(
        JSON.stringify({ error: 'call_record_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting transcription for call_record_id: ${call_record_id}`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the call record
    const { data: record, error: fetchError } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', call_record_id)
      .single();

    if (fetchError || !record) {
      console.error('Failed to fetch call record:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Call record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!record.recording_url) {
      return new Response(
        JSON.stringify({ error: 'No recording URL available for this call' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching audio from: ${record.recording_url}`);

    // Fetch the audio file from VICIdial server
    let audioResponse;
    try {
      audioResponse = await fetch(record.recording_url, {
        headers: { 'Accept': 'audio/*' },
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch audio from VICIdial:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audio from recording server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get audio as base64 for Gemini
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    console.log(`Audio fetched, size: ${audioBuffer.byteLength} bytes`);

    // Call Lovable AI (Gemini) for transcription and analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert call center quality analyst. You will analyze a call recording and provide:

1. A complete transcript of the conversation, formatted as:
   Agent: [what agent said]
   Customer: [what customer said]
   
2. An AI disposition (status) - one of: sale, callback, not-interested, disqualified, pending

3. A sub-disposition with more detail about the outcome

4. A brief summary of the call (2-3 sentences)

5. The main reason for the call outcome

6. Agent sentiment: excellent, good, average, bad, or very-bad

7. Customer sentiment: excellent, good, average, bad, or very-bad

Respond in the following JSON format only:
{
  "transcript": "Agent: Hello...\\nCustomer: Hi...",
  "status": "sale",
  "sub_disposition": "Credit card sale - premium package",
  "summary": "Customer called interested in services. Agent successfully upsold to premium package.",
  "reason": "Customer was satisfied with pricing and features offered",
  "agent_response": "excellent",
  "customer_response": "good"
}`;

    console.log('Sending audio to Lovable AI for transcription...');

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
              {
                type: 'text',
                text: 'Please transcribe and analyze this call recording. Provide the full transcript and analysis in the JSON format specified.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:audio/mpeg;base64,${audioBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Parse the AI response
    let analysisResult;
    try {
      const content = aiData.choices?.[0]?.message?.content || '';
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw AI content:', aiData.choices?.[0]?.message?.content);
      
      // Fallback: use the raw content as transcript
      analysisResult = {
        transcript: aiData.choices?.[0]?.message?.content || 'Transcription failed',
        status: record.status || 'pending',
        sub_disposition: record.sub_disposition || 'Unknown',
        summary: 'AI analysis could not be completed',
        reason: 'Unable to parse AI response',
        agent_response: null,
        customer_response: null,
      };
    }

    console.log('Updating call record with transcription results...');

    // Update the call record with transcription results
    const { error: updateError } = await supabase
      .from('call_records')
      .update({
        transcript: analysisResult.transcript,
        status: analysisResult.status,
        sub_disposition: analysisResult.sub_disposition,
        summary: analysisResult.summary,
        reason: analysisResult.reason,
        agent_response: analysisResult.agent_response,
        customer_response: analysisResult.customer_response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', call_record_id);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
      throw new Error('Failed to save transcription results');
    }

    console.log(`Transcription completed for call_record_id: ${call_record_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription completed successfully',
        data: analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
