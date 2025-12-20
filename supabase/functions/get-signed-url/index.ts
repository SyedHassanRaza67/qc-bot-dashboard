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
    // Extract user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's token to verify and get user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized: Invalid or expired token');
    }

    console.log('Authenticated user:', user.id);

    const { storagePath } = await req.json();
    
    if (!storagePath) {
      throw new Error('No storage path provided');
    }

    console.log('Generating signed URL for:', storagePath);

    // Verify the user owns this file (path should start with their user ID)
    const pathParts = storagePath.split('/');
    const fileOwnerId = pathParts[0];
    
    if (fileOwnerId !== user.id) {
      console.error('Access denied: User', user.id, 'tried to access file owned by', fileOwnerId);
      throw new Error('Access denied: You do not have permission to access this file');
    }

    // Use service role to create signed URL
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audio-recordings')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`);
    }

    console.log('Signed URL generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        signedUrl: signedUrlData.signedUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-signed-url function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: error instanceof Error && error.message.includes('Access denied') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
