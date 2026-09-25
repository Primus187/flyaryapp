// Edge Function: public share link of a marketplace listing (plan 8.4), same pattern as get-shared-flight.
//   crawlers (WhatsApp, Telegram, …) → small HTML page with Open Graph preview (title, price, first photo)
//   Accept: application/json         → listing data with signed photo URLs, for /shared/market/<token>
//   everyone else                    → redirect to the web app /shared/market/<token>
// What may be shown decides the database (marketplace_public_listing): only listed, public listings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CRAWLER_PATTERN = /WhatsApp|TelegramBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|bot|crawler|spider|preview/i;
const SPA_ORIGIN = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
const BUCKET = "marketplace-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function priceText(l: { price_type: string; price_cents: number | null; listing_type: string }): string {
  if (l.price_type === "free") return "Gratis";
  if (l.price_type === "on_request" || l.price_cents === null) return l.listing_type === "wanted" ? "Gesucht" : "Preis auf Anfrage";
  const chf = (l.price_cents / 100).toLocaleString("de-CH", { minimumFractionDigits: l.price_cents % 100 ? 2 : 0 });
  return `CHF ${chf}${l.price_type === "negotiable" ? " · Verhandelbar" : ""}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    if (!UUID.test(token)) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const isCrawler = CRAWLER_PATTERN.test(req.headers.get("user-agent") || "");
    const wantsJson = (req.headers.get("accept") || "").includes("application/json");
    const spaUrl = `${SPA_ORIGIN}/shared/market/${token}`;
    if (!isCrawler && !wantsJson) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: spaUrl } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: listing, error } = await admin.rpc("marketplace_public_listing", { _token: token });
    if (error) throw error;
    if (!listing) {
      return isCrawler
        ? new Response("<html><head><title>Anzeige nicht verfügbar</title></head><body>Anzeige nicht verfügbar</body></html>",
          { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } })
        : new Response(JSON.stringify({ error: "Listing not available" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const photos = (listing.photos ?? []) as { path: string; thumb_path: string }[];
    if (isCrawler) {
      let ogImage = "";
      if (photos[0]) {
        const { data } = await admin.storage.from(BUCKET).createSignedUrl(photos[0].path, 7 * 24 * 3600);
        ogImage = data?.signedUrl ?? "";
      }
      const title = `${listing.title} – ${priceText(listing)}`;
      const place = [listing.postal_code, listing.locality].filter(Boolean).join(" ");
      const description = [listing.is_school ? listing.school?.name : null, place, (listing.description || "").slice(0, 150)]
        .filter(Boolean).join(" · ") || "Flyary Marktplatz";
      const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="product">
<meta property="og:site_name" content="Flyary Marktplatz">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${spaUrl}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
</head><body><a href="${spaUrl}">${escapeHtml(title)}</a></body></html>`;
      return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
    }

    const paths = photos.flatMap((p) => [p.path, p.thumb_path]);
    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data } = await admin.storage.from(BUCKET).createSignedUrls(paths, 3600);
      (data ?? []).forEach((s) => { if (s.signedUrl && s.path) signed[s.path] = s.signedUrl; });
    }
    const result = { ...listing, photos: photos.map((p) => ({ url: signed[p.path] ?? "", thumb_url: signed[p.thumb_path] ?? "" })) };
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
