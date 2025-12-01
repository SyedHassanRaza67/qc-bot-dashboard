import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, fileName, metadata } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Processing audio file:', fileName);

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // Prepare form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, fileName || 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    console.log('Sending to OpenAI Whisper API...');

    // Send to OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Transcription completed');

    // Analyze the transcript using Lovable AI
    const analysisPrompt = `Analyze this call transcript and provide:
1. Call status (sale, callback, not-interested, disqualified, or pending)
2. Agent name (if mentioned)
3. Sub-disposition (brief category)
4. Reason for the status
5. A concise summary (1-2 sentences)
6. Campaign name (if mentioned, otherwise generate a relevant one)
7. Publisher name (if mentioned, otherwise generate one like "Publisher A")

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "status": "sale|callback|not-interested|disqualified|pending",
  "agentName": "agent name or null",
  "subDisposition": "brief category",
  "reason": "reason for status",
  "summary": "concise summary",
  "campaignName": "campaign name",
  "publisher": "publisher name"
}

Transcript: ${result.text}`;

    console.log('Analyzing transcript with AI...');

    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert call analyzer. Always return valid JSON only, no markdown formatting.' },
          { role: 'user', content: analysisPrompt }
        ],
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('AI analysis error:', errorText);
      throw new Error(`AI analysis error: ${errorText}`);
    }

    const analysisData = await analysisResponse.json();
    let analysis;
    
    try {
      const content = analysisData.choices[0].message.content;
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback values
      analysis = {
        status: 'pending',
        agentName: null,
        subDisposition: 'Requires Review',
        reason: 'Automated analysis pending',
        summary: result.text.substring(0, 200),
        campaignName: 'General Campaign',
        publisher: 'Publisher A'
      };
    }

    console.log('Analysis complete:', analysis);

    // Calculate duration from audio metadata or use default
    const duration = metadata?.duration || '0:00';

    // Generate unique IDs
    const systemCallId = `SYS-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const publisherId = `PUB-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const buyerId = `BUY-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Store in database
    const { data: record, error: dbError } = await supabase
      .from('call_records')
      .insert({
        caller_id: metadata?.callerId || '+1234567890',
        publisher: analysis.publisher,
        status: analysis.status,
        agent_name: analysis.agentName,
        sub_disposition: analysis.subDisposition,
        duration: duration,
        campaign_name: analysis.campaignName,
        reason: analysis.reason,
        summary: analysis.summary,
        system_call_id: systemCallId,
        publisher_id: publisherId,
        buyer_id: buyerId,
        transcript: result.text,
        audio_file_name: fileName,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('Record saved to database:', record.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        record: record,
        transcript: result.text,
        analysis: analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
