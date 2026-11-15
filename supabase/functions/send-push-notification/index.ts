import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

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

// ---------- Firebase Cloud Messaging (Android uygulaması) ----------
// Secret: FIREBASE_SERVICE_ACCOUNT = Firebase servis hesabı JSON dosyasının tamamı
interface ServiceAccount { project_id: string; client_email: string; private_key: string }
let fcmCache: { token: string; exp: number; projectId: string } | null = null;

async function getFcmAccess(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  const now = Math.floor(Date.now() / 1000);
  if (fcmCache && fcmCache.exp - 60 > now) return fcmCache;
  const sa = JSON.parse(raw) as ServiceAccount;
  const key = await importPKCS8(sa.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}: ${await res.text()}`);
  const j = await res.json();
  fcmCache = { token: j.access_token, exp: now + (j.expires_in ?? 3600), projectId: sa.project_id };
  return fcmCache;
}

async function sendFcm(
  user_id: string | undefined,
  broadcast: boolean,
  msg: { title: string; body: string; url: string; tag: string },
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const out = { sent: 0, failed: 0, errors: [] as string[] };
  let q = supabase.from("push_tokens").select("user_id, token").eq("is_active", true).neq("platform", "web");
  if (!broadcast) q = q.eq("user_id", user_id);
  const { data: rows, error } = await q;
  if (error || !rows || rows.length === 0) return out;

  const access = await getFcmAccess();
  if (!access) {
    out.errors.push("FIREBASE_SERVICE_ACCOUNT secret tanımlı değil");
    return out;
  }
  const endpoint = `https://fcm.googleapis.com/v1/projects/${access.projectId}/messages:send`;

  await Promise.all(
    (rows as { user_id: string; token: string }[]).map(async (r) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: r.token,
            notification: { title: msg.title, body: msg.body },
            data: { url: msg.url, tag: msg.tag },
            android: { priority: "high", notification: { tag: msg.tag, sound: "default" } },
          },
        }),
      });
      if (res.ok) { out.sent++; return; }
      out.failed++;
      const text = await res.text();
      out.errors.push(`FCM ${res.status}: ${text.slice(0, 200)}`);
      // Uygulama silinmiş / token geçersiz → pasif yap
      if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("INVALID_ARGUMENT")) {
        await supabase.from("push_tokens").update({ is_active: false }).eq("user_id", r.user_id).eq("token", r.token);
      }
    }),
  );
  return out;
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

    const msg = {
      title,
      body: body || "",
      url: url || "/",
      tag: tag || "ms-iletisim",
    };
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // 1) Android uygulaması (FCM)
    try {
      const r = await sendFcm(user_id, !!broadcast, msg);
      sent += r.sent; failed += r.failed; errors.push(...r.errors);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    // 2) Web tarayıcıları (Web Push / VAPID)
    const ok = await ensureVapid();
    let subs: SubRow[] = [];
    if (ok && vapidKeys) {
      let subQuery = supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("is_active", true);
      if (!broadcast) subQuery = subQuery.eq("user_id", user_id);
      const { data } = await subQuery;
      subs = (data as SubRow[] | null) ?? [];
    } else {
      errors.push("VAPID keys not configured");
    }

    const payload = JSON.stringify(msg);
    const pushOptions = vapidKeys
      ? { vapidDetails: { subject: vapidKeys.subject, publicKey: vapidKeys.public, privateKey: vapidKeys.private } }
      : {};

    await Promise.all(
      subs.map(async (sub) => {
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
          const m = err instanceof Error ? err.message : String(err);
          errors.push(`${status ?? "?"}: ${m}`);
          if (status === 404 || status === 410) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
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
