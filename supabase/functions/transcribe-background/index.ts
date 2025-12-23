import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_STATUSES = ['sale', 'callback', 'not-interested', 'disqualified', 'pending'] as const;
const VALID_RESPONSES = ['excellent', 'good', 'average', 'bad', 'very-bad'] as const;

type ValidStatus = typeof VALID_STATUSES[number];
type ValidResponse = typeof VALID_RESPONSES[number];

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

// Generate URL variations to try (MP3/WAV, with/without MP3 folder, http/https)
function getUrlVariations(originalUrl: string): string[] {
  const urls: string[] = [originalUrl];
  
  // Try http if https
  if (originalUrl.startsWith('https://')) {
    urls.push(originalUrl.replace('https://', 'http://'));
  }
  
  // Try MP3 folder variations
  if (originalUrl.includes('/RECORDINGS/MP3/')) {
    urls.push(originalUrl.replace('/RECORDINGS/MP3/', '/RECORDINGS/'));
  } else if (originalUrl.includes('/RECORDINGS/') && !originalUrl.includes('/RECORDINGS/MP3/')) {
    urls.push(originalUrl.replace('/RECORDINGS/', '/RECORDINGS/MP3/'));
  }
  
  // Try file extension variations
  const withMp3 = urls.filter(u => u.endsWith('.mp3')).map(u => u.replace('.mp3', '.wav'));
  const withWav = urls.filter(u => u.endsWith('.wav')).map(u => u.replace('.wav', '.mp3'));
  urls.push(...withMp3, ...withWav);
  
  // Dedupe
  return [...new Set(urls)];
}

// Try fetching audio from a URL with timeout
async function tryFetchAudio(url: string, timeoutMs: number = 15000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, { 
      headers: { 'Accept': 'audio/*' },
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`Audio fetch success: ${url}`);
      return response;
    }
    console.log(`Audio fetch failed: ${url} - ${response.status}`);
    return null;
  } catch (e) {
    console.log(`Audio fetch error: ${url} - ${e}`);
    return null;
  }
}

// Process a single record - returns success/fail
async function processRecord(
  record: { id: string; recording_url: string | null; system_call_id: string },
  supabase: any,
  LOVABLE_API_KEY: string
): Promise<boolean> {
  try {
    if (!record.recording_url) {
      await supabase.from('call_records').update({ summary: 'No recording URL' }).eq('id', record.id);
      return false;
    }

    // Mark as processing
    await supabase.from('call_records').update({ summary: 'Transcribing...' }).eq('id', record.id);

    // Try multiple URL variations
    const urlsToTry = getUrlVariations(record.recording_url);
    console.log(`Trying ${urlsToTry.length} URL variations for ${record.system_call_id}`);
    
    let audioResponse: Response | null = null;
    let successUrl = '';
    
    for (const url of urlsToTry) {
      audioResponse = await tryFetchAudio(url);
      if (audioResponse) {
        successUrl = url;
        break;
      }
    }
    
    if (!audioResponse) {
      // Mark as audio not available so we don't retry endlessly
      await supabase.from('call_records').update({ 
        summary: 'Recording not available on server',
        updated_at: new Date().toISOString()
      }).eq('id', record.id);
      console.log(`All URL variations failed for ${record.system_call_id}`);
      return false;
    }

    // Update recording_url if we found a working one different from original
    if (successUrl !== record.recording_url) {
      await supabase.from('call_records').update({ recording_url: successUrl }).eq('id', record.id);
      console.log(`Updated recording_url to working URL: ${successUrl}`);
    }

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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text().catch(() => '');
      throw new Error(`AI failed: ${aiResponse.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
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
      } catch {
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

    console.log(`Completed: ${record.system_call_id}`);
    return true;
  } catch (err) {
    console.error(`Failed ${record.id}:`, err);
    
    // Store specific error message for better diagnostics
    let errorSummary = 'Transcription failed';
    const errMsg = err instanceof Error ? err.message : String(err);
    
    if (errMsg.includes('402')) {
      errorSummary = 'Transcription failed: AI credits exhausted (402)';
    } else if (errMsg.includes('429')) {
      errorSummary = 'Transcription failed: AI rate limited (429)';
    } else if (errMsg.includes('Audio fetch failed')) {
      errorSummary = `Transcription failed: ${errMsg}`;
    } else if (errMsg.includes('aborted') || errMsg.includes('timeout')) {
      errorSummary = 'Transcription failed: Audio fetch timeout';
    } else {
      errorSummary = `Transcription failed: ${errMsg.substring(0, 100)}`;
    }
    
    await supabase.from('call_records').update({ summary: errorSummary }).eq('id', record.id);
    return false;
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
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Authenticate the user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get user_id from authenticated user, not from request body
    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const recordId = body.record_id; // Single record transcription
    const limit = body.limit || 10;
    const concurrency = body.concurrency || 1; // Default to sequential (1 at a time)

    console.log(`Transcribe-background called for authenticated user: ${userId}, limit: ${limit}, concurrency: ${concurrency}, recordId: ${recordId || 'batch mode'}`);

    let pendingRecords;
    
    // If record_id is provided, transcribe only that specific record
    if (recordId) {
      console.log(`[transcribe-background] Single record mode: ${recordId}`);
      const { data, error: queryError } = await supabase
        .from('call_records')
        .select('id, recording_url, system_call_id')
        .eq('id', recordId)
        .eq('user_id', userId)
        .single();

      if (queryError) {
        console.error('Single record fetch error:', queryError);
        return new Response(
          JSON.stringify({ success: false, error: queryError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      pendingRecords = data ? [data] : [];
    } else {
      // Batch mode: Find pending records for this user
      const { data, error: fetchError } = await supabase
        .from('call_records')
        .select('id, recording_url, system_call_id')
        .eq('user_id', userId)
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
      pendingRecords = data || [];
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      console.log('No pending records found');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending records', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingRecords.length} records in parallel (${concurrency} at a time)`);
    
    let successCount = 0;
    let failCount = 0;

    // Process in batches of `concurrency` records
    for (let i = 0; i < pendingRecords.length; i += concurrency) {
      const batch = pendingRecords.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}: ${batch.length} records`);
      
      const results = await Promise.all(
        batch.map(record => processRecord(record, supabase, LOVABLE_API_KEY))
      );
      
      results.forEach(success => {
        if (success) successCount++;
        else failCount++;
      });
    }

    console.log(`Transcription complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: pendingRecords.length, 
        success_count: successCount, 
        fail_count: failCount 
      }),
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