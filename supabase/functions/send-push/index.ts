import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const bytesToB64url = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// RFC 8291 / RFC 8188: encrypt the payload with aes128gcm for Web Push.
async function encryptPayload(payload: string, p256dhB64: string, authB64: string) {
  const uaPublicRaw = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublicRaw as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const localPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey },
    localKeys.privateKey,
    256
  );
  const shared = new Uint8Array(sharedBits);

  const enc = new TextEncoder();
  const prk = await hkdf(
    authSecret,
    shared,
    concat(enc.encode("WebPush: info\0"), uaPublicRaw, localPublicRaw),
    32
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekBytes = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const cek = await crypto.subtle.importKey("raw", cekBytes as BufferSource, "AES-GCM", false, ["encrypt"]);
  const record = concat(enc.encode(payload), new Uint8Array([0x02]));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, cek, record as BufferSource)
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);

  return concat(salt, recordSize, new Uint8Array([localPublicRaw.length]), localPublicRaw, cipher);
}

async function createVapidAuthHeader(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.hostname}`;

  const publicKeyRaw = b64urlToBytes(vapidPublicKey);
  const privateKeyRaw = b64urlToBytes(vapidPrivateKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToB64url(publicKeyRaw.slice(1, 33)),
      y: bytesToB64url(publicKeyRaw.slice(33, 65)),
      d: bytesToB64url(privateKeyRaw),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const enc = new TextEncoder();
  const headerB64 = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payloadB64 = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: "mailto:push@flyary.app",
      })
    )
  );
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // WebCrypto returns the raw r||s signature Web Push expects.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsignedToken))
  );

  return `vapid t=${unsignedToken}.${bytesToB64url(signature)}, k=${vapidPublicKey}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { user_id, title, body, url } = await req.json();
    if (!user_id || !title) {
      return json({ error: "Missing user_id or title" }, 400);
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
      return json({ sent: 0, reason: "no_subscription" });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys are not configured");
      return json({ sent: 0, reason: "vapid_missing", error: "VAPID keys are not configured" }, 500);
    }

    const payload = JSON.stringify({ title, body: body || "", url: url || "/" });
    let sent = 0;
    const failures: { status?: number; detail: string }[] = [];

    for (const sub of subscriptions) {
      try {
        const authorization = await createVapidAuthHeader(sub.endpoint, vapidPublicKey, vapidPrivateKey);
        const encrypted = await encryptPayload(payload, sub.keys_p256dh, sub.keys_auth);

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Urgency: "normal",
            Authorization: authorization,
          },
          body: encrypted as BodyInit,
        });

        if (res.ok) {
          sent++;
          await res.body?.cancel();
        } else {
          const detail = await res.text();
          console.error(`Push endpoint failed [${res.status}]: ${detail}`);
          failures.push({ status: res.status, detail });
          if (res.status === 404 || res.status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      } catch (e) {
        console.error("Push send error:", e);
        failures.push({ detail: (e as Error)?.message ?? String(e) });
      }
    }

    return json({ sent, failures });
  } catch (error) {
    console.error("Send-push error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
