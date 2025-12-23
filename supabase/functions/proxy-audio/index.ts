import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Allowed domains for audio proxying - add trusted audio sources here
const ALLOWED_DOMAINS = [
  "recording.vicidial.com",
  "recordings.vicidial.com",
  "vicidial.com",
  "vicibox.com",
  "138.201.244.63", // VICIdial server IP
];

function isAllowedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Allow backend storage URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl) {
      const supabaseHostname = new URL(supabaseUrl).hostname;
      if (
        urlObj.hostname === supabaseHostname ||
        urlObj.hostname.endsWith(".supabase.co")
      ) {
        return true;
      }
    }

    // Allow common VICIdial recording paths (case-insensitive)
    const path = urlObj.pathname.toLowerCase();
    if (path.includes("/recordings/")) {
      console.log("Allowing VICIdial recording URL:", url);
      return true;
    }

    // Check against allowlisted domains
    return ALLOWED_DOMAINS.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

function dedupe(urls: string[]) {
  return [...new Set(urls.filter(Boolean))];
}

function addCaseVariants(urls: string[], originalUrl: string) {
  // Some setups use lowercase folders
  urls.push(originalUrl.replace(/\/RECORDINGS\//g, "/recordings/"));
  urls.push(originalUrl.replace(/\/recordings\//g, "/RECORDINGS/"));
  urls.push(originalUrl.replace(/\/MP3\//g, "/mp3/"));
  urls.push(originalUrl.replace(/\/mp3\//g, "/MP3/"));
  // Combined
  urls.push(
    originalUrl
      .replace(/\/RECORDINGS\//g, "/recordings/")
      .replace(/\/MP3\//g, "/mp3/")
  );
}

async function tryFetchAudio(audioUrl: string): Promise<Response | null> {
  try {
    const response = await fetch(audioUrl, {
      headers: { Accept: "audio/*" },
    });

    if (response.ok) return response;

    console.log("Fetch failed:", {
      url: audioUrl,
      status: response.status,
      statusText: response.statusText,
    });
    return null;
  } catch (err) {
    console.log("Fetch threw error:", {
      url: audioUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function getUrlVariations(originalUrl: string): string[] {
  const urls: string[] = [originalUrl];

  const addVicidialVariants = (u: string) => {
    try {
      const parsed = new URL(u);
      const pathLower = parsed.pathname.toLowerCase();

      // Many VICIdial installs serve recordings under /vicidial/RECORDINGS/... instead of /RECORDINGS/...
      if (!pathLower.startsWith("/vicidial/") && pathLower.includes("/recordings/")) {
        const withVicidial = new URL(u);
        withVicidial.pathname = `/vicidial${parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`}`;
        urls.push(withVicidial.toString());
      }

      // And some serve them at root even if a URL includes /vicidial/
      if (pathLower.startsWith("/vicidial/")) {
        const withoutVicidial = new URL(u);
        withoutVicidial.pathname = parsed.pathname.replace(/^\/vicidial/i, "");
        if (!withoutVicidial.pathname.startsWith("/")) withoutVicidial.pathname = `/${withoutVicidial.pathname}`;
        urls.push(withoutVicidial.toString());
      }
    } catch {
      // ignore
    }
  };

  // Case variants first
  addCaseVariants(urls, originalUrl);
  addVicidialVariants(originalUrl);

  // Protocol swap (some VICIdial boxes serve recordings only on one of them)
  try {
    const parsed = new URL(originalUrl);
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
      urls.push(parsed.toString());
    } else if (parsed.protocol === "https:") {
      parsed.protocol = "http:";
      urls.push(parsed.toString());
    }
  } catch {
    // ignore
  }

  const lower = originalUrl.toLowerCase();

  const hasRecordings = /\/recordings\//i.test(originalUrl);
  const hasMp3Folder = /\/mp3\//i.test(originalUrl);

  // WAV -> MP3
  if (hasRecordings && !hasMp3Folder && lower.endsWith(".wav")) {
    urls.push(
      originalUrl
        .replace(/\/recordings\//i, "/RECORDINGS/")
        .replace(/\/RECORDINGS\//, "/RECORDINGS/MP3/")
        .replace(/\.wav$/i, ".mp3")
    );
  }
  if (lower.endsWith(".wav")) {
    urls.push(originalUrl.replace(/\.wav$/i, ".mp3"));
  }

  // MP3 -> WAV
  if (lower.endsWith(".mp3")) {
    urls.push(originalUrl.replace(/\.mp3$/i, ".wav"));
  }

  // Folder toggles
  if (hasRecordings && !hasMp3Folder) {
    urls.push(originalUrl.replace(/\/recordings\//i, "/RECORDINGS/MP3/"));
    urls.push(originalUrl.replace(/\/recordings\//i, "/recordings/mp3/"));
  }
  if (hasRecordings && hasMp3Folder) {
    urls.push(originalUrl.replace(/\/mp3\//i, "/"));
    urls.push(originalUrl.replace(/\/mp3\//i, "/").replace(/\.mp3$/i, ".wav"));
    urls.push(originalUrl.replace(/\/RECORDINGS\/(MP3|mp3)\//, "/RECORDINGS/"));
    urls.push(originalUrl.replace(/\/recordings\/(MP3|mp3)\//, "/recordings/"));
  }

  // Add case + /vicidial variants for all newly generated urls
  const expanded = [...urls];
  for (const u of expanded) {
    addCaseVariants(urls, u);
    addVicidialVariants(u);
  }

  return dedupe(urls);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log("Invalid token or user not found:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id);

    const body = await req.json().catch(() => ({}));
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL is from allowed domain
    if (!isAllowedUrl(url)) {
      console.log("URL not in allowed domains:", url);
      return new Response(
        JSON.stringify({ error: "Domain not allowed - URL must be from a trusted source" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Proxying audio from:", url, "for user:", user.id);

    const urlsToTry = getUrlVariations(url);
    console.log("URL variations to try:", urlsToTry);

    let audioResponse: Response | null = null;
    let successUrl = "";

    for (const tryUrl of urlsToTry) {
      console.log("Trying URL:", tryUrl);
      audioResponse = await tryFetchAudio(tryUrl);
      if (audioResponse) {
        successUrl = tryUrl;
        console.log("Success with URL:", tryUrl);
        break;
      }
      console.log("Failed with URL:", tryUrl);
    }

    if (!audioResponse) {
      console.error("Failed to fetch audio from all URL variations");
      return new Response(JSON.stringify({ error: "Failed to fetch audio: file not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";

    console.log(
      "Audio fetched successfully from:",
      successUrl,
      "size:",
      audioBuffer.byteLength,
      "type:",
      contentType
    );

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error proxying audio:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
