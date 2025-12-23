import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RetryBody = {
  minAgeSeconds?: number;
  limit?: number;
};

const normalizeBaseUrl = (serverUrl: string) => {
  const trimmed = serverUrl.replace(/\/+$/, "");
  return trimmed.split("/vicidial")[0];
};

// Generate multiple URL variations to try (prefer MP3 paths first)
const getUrlVariations = (
  baseUrl: string,
  originalUrl: string,
  leadId: string | null,
  timestamp: string | null
): string[] => {
  const variations: string[] = [];

  const add = (u?: string | null) => {
    if (!u) return;
    variations.push(u);
  };

  const toHttp = (u: string) => (u.startsWith("https://") ? u.replace("https://", "http://") : u);

  if (originalUrl) {
    const original = toHttp(originalUrl);

    // Always try mp3 variants first
    if (original.toLowerCase().endsWith(".wav")) {
      const mp3 = original.replace(/\.wav$/i, ".mp3");
      add(mp3);
      add(mp3.replace("/RECORDINGS/", "/RECORDINGS/MP3/"));
    }

    add(original);

    // Toggle MP3 folder
    if (original.includes("/RECORDINGS/MP3/")) {
      add(original.replace("/RECORDINGS/MP3/", "/RECORDINGS/"));
    } else if (original.includes("/RECORDINGS/")) {
      add(original.replace("/RECORDINGS/", "/RECORDINGS/MP3/"));
    }

    // Toggle extensions
    if (original.toLowerCase().endsWith(".mp3")) {
      add(original.replace(/\.mp3$/i, ".wav"));
    } else if (original.toLowerCase().endsWith(".wav")) {
      add(original.replace(/\.wav$/i, ".mp3"));
    }

    // Some installs use /vicidial prefix
    if (original.includes("/RECORDINGS/")) {
      const after = original.split("/RECORDINGS/")[1];
      if (after) {
        add(`${baseUrl}/vicidial/RECORDINGS/${after}`);
        add(`${baseUrl}/vicidial/RECORDINGS/MP3/${after}`);
      }
    }
  }

  // Construct from timestamp + leadId (common VICIdial naming)
  if (timestamp && leadId) {
    const d = new Date(timestamp);
    const formattedDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;

    add(`${baseUrl}/RECORDINGS/MP3/${formattedDate}_${leadId}-all.mp3`);
    add(`${baseUrl}/RECORDINGS/${formattedDate}_${leadId}-all.mp3`);
    add(`${baseUrl}/RECORDINGS/${formattedDate}_${leadId}-all.wav`);
    add(`${baseUrl}/vicidial/RECORDINGS/MP3/${formattedDate}_${leadId}-all.mp3`);
  }

  // Dedupe
  return [...new Set(variations)];
};

const checkUrlExists = async (url: string): Promise<{ ok: boolean; status?: number }> => {
  // 1) HEAD (fast)
  try {
    const head = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "AI-Audio-Analyzer/1.0" },
    });
    if (head.ok) return { ok: true, status: head.status };

    // Some servers reject HEAD; fall back to a 1-byte range GET
    if (head.status !== 403 && head.status !== 405) {
      return { ok: false, status: head.status };
    }
  } catch {
    // fall through to GET
  }

  // 2) GET with Range bytes=0-0
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "AI-Audio-Analyzer/1.0",
        Range: "bytes=0-0",
        Accept: "audio/*",
      },
    });

    clearTimeout(timeout);
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RetryBody = await req.json().catch(() => ({}));
    const minAgeSeconds = Math.max(15, Math.min(10 * 60, body.minAgeSeconds ?? 60));
    const limit = Math.max(1, Math.min(200, body.limit ?? 100));

    // Fetch VICIdial integration for baseUrl
    const { data: integration, error: integrationError } = await supabase
      .from("dialer_integrations")
      .select("server_url")
      .eq("user_id", user.id)
      .eq("dialer_type", "vicidial")
      .eq("is_active", true)
      .maybeSingle();

    if (integrationError || !integration?.server_url) {
      return new Response(
        JSON.stringify({ success: false, error: "No active VICIdial integration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const baseUrl = normalizeBaseUrl(integration.server_url);
    const threshold = new Date(Date.now() - minAgeSeconds * 1000).toISOString();

    const { data: processingRecords, error: fetchError } = await supabase
      .from("call_records")
      .select("id, system_call_id, recording_url, lead_id, timestamp, summary, updated_at")
      .eq("user_id", user.id)
      .eq("is_processing", true)
      .lte("updated_at", threshold)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error("[retry-wav-recordings] fetchError:", fetchError);
      throw fetchError;
    }

    if (!processingRecords || processingRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No records ready to retry", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[retry-wav-recordings] Retrying ${processingRecords.length} records (minAgeSeconds=${minAgeSeconds})`
    );

    let updatedCount = 0;
    let stillProcessing = 0;

    for (const record of processingRecords) {
      const urlVariations = getUrlVariations(
        baseUrl,
        record.recording_url || "",
        record.lead_id,
        record.timestamp
      );

      const mp3First = [
        ...urlVariations.filter((u) => u.toLowerCase().endsWith(".mp3")),
        ...urlVariations.filter((u) => !u.toLowerCase().endsWith(".mp3")),
      ];

      let foundMp3: string | null = null;

      for (const url of mp3First) {
        const { ok, status } = await checkUrlExists(url);
        if (!ok) continue;

        if (url.toLowerCase().endsWith(".mp3")) {
          foundMp3 = url.startsWith("https://") ? url.replace("https://", "http://") : url;
          console.log(`[retry-wav-recordings] ${record.system_call_id}: mp3 ready (${status}) -> ${foundMp3}`);
          break;
        }
      }

      if (foundMp3) {
        const { error: updateError } = await supabase
          .from("call_records")
          .update({
            recording_url: foundMp3,
            is_processing: false,
            summary: "Pending AI analysis",
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id)
          .eq("user_id", user.id);

        if (updateError) {
          console.error(`[retry-wav-recordings] Update failed for ${record.id}:`, updateError);
          stillProcessing++;
        } else {
          updatedCount++;
        }

        continue;
      }

      // Not ready yet — bump updated_at so we don't hammer more than once per minute.
      const stillUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (record.summary?.includes("Recording not available")) {
        stillUpdate.summary = "Processing audio...";
      }

      await supabase
        .from("call_records")
        .update(stillUpdate)
        .eq("id", record.id)
        .eq("user_id", user.id);

      stillProcessing++;
    }

    // Kick off analysis for newly-ready recordings (in background)
    if (updatedCount > 0) {
      const task = fetch(`${supabaseUrl}/functions/v1/transcribe-background`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: updatedCount, concurrency: 5 }),
      }).catch((err) => console.error("[retry-wav-recordings] Failed to trigger transcription:", err));

      // @ts-ignore - EdgeRuntime exists in the edge runtime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(task);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        retried: processingRecords.length,
        updated: updatedCount,
        stillProcessing,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[retry-wav-recordings] error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
