import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push requires signing with VAPID keys using ES256 (ECDSA P-256)
async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const publicKeyRaw = Uint8Array.from(atob(publicKeyB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const privateKeyRaw = Uint8Array.from(atob(privateKeyB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

  // Build JWK for the private key
  const x = btoa(String.fromCharCode(...publicKeyRaw.slice(1, 33))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const y = btoa(String.fromCharCode(...publicKeyRaw.slice(33, 65))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const d = btoa(String.fromCharCode(...privateKeyRaw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return key;
}

async function createVapidAuthHeader(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.hostname}`;
  
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:push@flyary.app",
  };

  const enc = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await importVapidKeys(vapidPublicKey, vapidPrivateKey);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format expected by Web Push
  const sigArray = new Uint8Array(signature);
  const sigB64 = btoa(String.fromCharCode(...sigArray)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return {
    authorization: `vapid t=${unsignedToken}.${sigB64}, k=${vapidPublicKey}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, url } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "Missing user_id or title" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const payload = JSON.stringify({ title, body: body || "", url: url || "/" });
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        const { authorization } = await createVapidAuthHeader(sub.endpoint, vapidPublicKey, vapidPrivateKey);

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "TTL": "86400",
            Authorization: authorization,
          },
          body: new TextEncoder().encode(payload),
        });

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription expired, remove it
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      } catch (e) {
        console.error("Push send error:", e);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send-push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
