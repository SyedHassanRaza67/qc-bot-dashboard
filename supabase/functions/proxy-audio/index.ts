import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed domains for audio proxying - add trusted audio sources here
const ALLOWED_DOMAINS = [
  'recording.vicidial.com',
  'recordings.vicidial.com',
  'vicidial.com',
  'vicibox.com',
  '138.201.244.63',  // VICIdial server IP
];

// Check if URL is from an allowed domain
function isAllowedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Allow Supabase storage URLs
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (supabaseUrl) {
      const supabaseHostname = new URL(supabaseUrl).hostname;
      if (urlObj.hostname === supabaseHostname || urlObj.hostname.endsWith('.supabase.co')) {
        return true;
      }
    }
    
    // Allow any IP-based URL that serves VICIdial recordings
    if (urlObj.pathname.includes('/RECORDINGS/')) {
      console.log('Allowing VICIdial recording URL:', url);
      return true;
    }
    
    // Check against allowed domains
    return ALLOWED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify the user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('Invalid token or user not found:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate URL is from allowed domain
    if (!isAllowedUrl(url)) {
      console.log('URL not in allowed domains:', url);
      return new Response(
        JSON.stringify({ error: 'Domain not allowed - URL must be from a trusted source' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Proxying audio from:', url, 'for user:', user.id);

    // Helper function to try fetching with URL variations
    async function tryFetchAudio(audioUrl: string): Promise<Response | null> {
      const response = await fetch(audioUrl, {
        headers: { 'Accept': 'audio/*' },
      });
      if (response.ok) return response;
      return null;
    }

    // Generate URL variations to try
    function getUrlVariations(originalUrl: string): string[] {
      const urls = [originalUrl];
      
      // If it's a WAV in /RECORDINGS/, try MP3 version in /RECORDINGS/MP3/
      if (originalUrl.includes('/RECORDINGS/') && !originalUrl.includes('/MP3/') && originalUrl.endsWith('.wav')) {
        const mp3Url = originalUrl
          .replace('/RECORDINGS/', '/RECORDINGS/MP3/')
          .replace('.wav', '.mp3');
        urls.push(mp3Url);
      }
      
      // If it's a WAV anywhere, also try just changing extension
      if (originalUrl.endsWith('.wav')) {
        urls.push(originalUrl.replace('.wav', '.mp3'));
      }
      
      // If in /RECORDINGS/ but not /MP3/, try adding /MP3/
      if (originalUrl.includes('/RECORDINGS/') && !originalUrl.includes('/MP3/')) {
        urls.push(originalUrl.replace('/RECORDINGS/', '/RECORDINGS/MP3/'));
      }
      
      return [...new Set(urls)]; // Remove duplicates
    }

    const urlsToTry = getUrlVariations(url);
    console.log('URL variations to try:', urlsToTry);

    let audioResponse: Response | null = null;
    let successUrl = '';

    for (const tryUrl of urlsToTry) {
      console.log('Trying URL:', tryUrl);
      audioResponse = await tryFetchAudio(tryUrl);
      if (audioResponse) {
        successUrl = tryUrl;
        console.log('Success with URL:', tryUrl);
        break;
      }
      console.log('Failed with URL:', tryUrl);
    }

    if (!audioResponse) {
      console.error('Failed to fetch audio from all URL variations');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audio: file not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';

    console.log('Audio fetched successfully from:', successUrl, 'size:', audioBuffer.byteLength, 'type:', contentType);

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error proxying audio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
