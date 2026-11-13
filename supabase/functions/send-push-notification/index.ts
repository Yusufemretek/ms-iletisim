import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

let vapidKeys: { public: string; private: string; subject: string } | null = null;

async function ensureVapid(): Promise<boolean> {
  if (vapidKeys) return true;
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);
  if (error || !data || data.length === 0) return false;
  const m = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  const pub = m.get("VAPID_PUBLIC_KEY") ?? "";
  const priv = m.get("VAPID_PRIVATE_KEY") ?? "";
  const subj = m.get("VAPID_SUBJECT") ?? "mailto:admin@msiletisim.com";
  if (!pub || !priv) return false;
  vapidKeys = { public: pub, private: priv, subject: subj };
  try {
    webpush.setVapidDetails(subj, pub, priv);
  } catch {
    // setVapidDetails may fail in some runtimes; we pass options directly instead
  }
  return true;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, title, body, url, tag, broadcast } = await req.json();
    if (!title) {
      return new Response(
        JSON.stringify({ error: "title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!user_id && !broadcast) {
      return new Response(
        JSON.stringify({ error: "user_id or broadcast is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ok = await ensureVapid();
    if (!ok || !vapidKeys) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let subQuery = supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("is_active", true);

    if (!broadcast) {
      subQuery = subQuery.eq("user_id", user_id);
    }

    const { data: subs, error: subErr } = await subQuery;

    if (subErr || !subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No active subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/",
      tag: tag || "ms-iletisim",
    });

    const pushOptions = {
      vapidDetails: {
        subject: vapidKeys.subject,
        publicKey: vapidKeys.public,
        privateKey: vapidKeys.private,
      },
    };

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    await Promise.all(
      (subs as SubRow[]).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            pushOptions,
          );
          sent++;
        } catch (err: unknown) {
          failed++;
          const status = (err as { statusCode?: number }).statusCode;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${status ?? "?"}: ${msg}`);
          if (status === 404 || status === 410) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("user_id", user_id)
              .eq("endpoint", sub.endpoint);
          }
        }
      }),
    );

    return new Response(
      JSON.stringify({ sent, failed, errors: errors.slice(0, 3) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
