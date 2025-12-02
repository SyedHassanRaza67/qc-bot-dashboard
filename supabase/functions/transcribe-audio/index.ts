import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use Lovable AI (Gemini) for transcription and analysis
    const analysisPrompt = `You are an expert audio transcription and call analysis AI. 

Please analyze this audio file and provide:
1. A full transcription of the audio
2. Call status (sale, callback, not-interested, disqualified, or pending)
3. Agent name (if mentioned)
4. Sub-disposition (brief category)
5. Reason for the status
6. A concise summary (1-2 sentences)
7. Campaign name (if mentioned, otherwise generate a relevant one)
8. Publisher name (if mentioned, otherwise generate one like "Publisher A")

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "transcript": "full transcription of the audio",
  "status": "sale|callback|not-interested|disqualified|pending",
  "agentName": "agent name or null",
  "subDisposition": "brief category",
  "reason": "reason for status",
  "summary": "concise summary",
  "campaignName": "campaign name",
  "publisher": "publisher name"
}`;

    console.log('Sending to Lovable AI for transcription and analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert audio transcription and call analysis AI. Always return valid JSON only, no markdown formatting.' 
          },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: analysisPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:audio/webm;base64,${audio}` 
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
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable workspace.');
      }
      throw new Error(`AI analysis error: ${errorText}`);
    }

    const analysisData = await response.json();
    let analysis;
    
    try {
      const content = analysisData.choices[0].message.content;
      console.log('AI Response:', content);
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback values
      analysis = {
        transcript: 'Transcription failed - please try again',
        status: 'pending',
        agentName: null,
        subDisposition: 'Requires Review',
        reason: 'Automated analysis pending',
        summary: 'Audio processing encountered an issue',
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
        transcript: analysis.transcript,
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
        transcript: analysis.transcript,
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
