// Pilot sign-up from the website (www.flyary.ch/<lang>/testpilot/). A plain HTML form posts here
// (no login, works without JavaScript); the function checks the input and answers with a redirect
// back to the website. Stored through join_pilot_waitlist() (migration 0078) with the service role.
// Deployed with verify_jwt = false (supabase/config.toml): the website has no session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseWaitlistForm, redirectTarget, websiteOrigin } from "./waitlist.ts";

const redirect = (location: string) => new Response(null, { status: 303, headers: { Location: location } });

// Shortened hash of the IP address and the day: enough for the rate limit, not a stored address.
async function requesterHash(ip: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${day}|flyary-waitlist`));
  return Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = websiteOrigin(req.headers.get("origin"), req.headers.get("referer"));
  if (req.method !== "POST") return redirect(`${origin}/de/testpilot/`);

  let form: FormData;
  try { form = await req.formData(); } catch { return redirect(redirectTarget(origin, "de", "invalid")); }
  const parsed = parseWaitlistForm(form, Date.now());
  if (parsed.kind === "spam") return redirect(redirectTarget(origin, parsed.language, "ok"));
  if (parsed.kind === "invalid") return redirect(redirectTarget(origin, parsed.language, "invalid"));

  const { entry } = parsed;
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const { data, error } = await admin.rpc("join_pilot_waitlist", {
      _name: entry.name, _email: entry.email, _language: entry.language, _role: entry.role, _disciplines: entry.disciplines,
      _school: entry.school, _comment: entry.comment, _requester_hash: await requesterHash(ip),
    });
    if (error) throw error;
    const outcome = data === "ok" || data === "invalid" || data === "rate_limited" ? data : "error";
    return redirect(redirectTarget(origin, entry.language, outcome));
  } catch (err) {
    console.error("website-waitlist failed", err);
    return redirect(redirectTarget(origin, entry.language, "error"));
  }
});
