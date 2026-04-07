

# Open-Graph Meta-Tags für geteilte Flüge

## Problem
WhatsApp/Telegram lesen OG-Tags aus dem HTML-Quellcode **bevor** JavaScript ausgeführt wird. Da die App eine SPA ist, sehen Crawler nur die statischen Tags aus `index.html` — nie die flugspezifischen Daten.

## Lösung
Die Edge Function `get-shared-flight` erkennt Crawler (WhatsApp, Telegram, etc.) am User-Agent und liefert statt JSON eine **HTML-Seite mit dynamischen OG-Tags** zurück. Normale Browser bekommen weiterhin JSON.

### Neuer Ansatz: Crawler-Erkennung in der Edge Function

**Änderung in `supabase/functions/get-shared-flight/index.ts`:**

1. User-Agent prüfen auf bekannte Crawler-Patterns (`WhatsApp`, `TelegramBot`, `facebookexternalhit`, `Twitterbot`, `LinkedInBot`, `bot`, `crawler`)
2. Wenn Crawler → HTML mit OG-Tags zurückgeben:
   - `og:title`: Pilotname + Startplatz + Datum
   - `og:description`: Dauer, Höhenmeter, Distanz, Gleitschirm
   - `og:image`: Erstes Flugfoto (signierte URL) oder ein Default-Bild
   - `og:url`: `https://flyaryapp.lovable.app/shared/flights/{token}`
   - `og:type`: `article`
   - Twitter-Card-Tags
3. Wenn kein Crawler → bisheriges JSON-Verhalten beibehalten

```text
Crawler-Request:
  GET /functions/v1/get-shared-flight?token=abc
  User-Agent: WhatsApp/2.x
  → Returns HTML with OG meta tags + redirect to SPA

Normal browser:
  GET /functions/v1/get-shared-flight?token=abc
  → Returns JSON (wie bisher)
```

### Problem: URL-Routing

WhatsApp/Telegram rufen aber `/shared/flights/:token` auf, nicht die Edge Function. Lösung:

**Neue Edge Function `og-flight-preview`** die als eigenständiger Endpunkt dient, ODER besser:

**SharedFlightDetail.tsx anpassen**: Im `<head>` dynamisch OG-Tags setzen via `document.title` etc. — das funktioniert aber **nicht** für Crawler.

**Beste Lösung**: Eine zweite, schlanke Edge Function `og-flight-preview` erstellen, die WhatsApp als Link-Preview-URL dient. Der Share-Link wird angepasst auf die Edge Function URL mit Redirect:

Eigentlich einfachste Lösung: **Die SharedFlightDetail-Route bleibt**, aber wir fügen einen `_redirects`-Eintrag oder einen Workaround hinzu.

Da Lovable kein SSR hat, ist der pragmatischste Weg:

### Finaler Ansatz

1. **Share-URL ändern**: Statt `flyaryapp.lovable.app/shared/flights/{token}` wird `{SUPABASE_URL}/functions/v1/get-shared-flight?token={token}` als Share-URL verwendet
2. **Edge Function erweitert**: 
   - Crawler → HTML mit OG-Tags + `<meta http-equiv="refresh">` Redirect zur SPA
   - Normale Browser → `302 Redirect` zur SPA-Route `/shared/flights/{token}`
   - API-Calls (mit `Accept: application/json`) → JSON wie bisher

### Änderungen

**`supabase/functions/get-shared-flight/index.ts`:**
- Crawler-Detection via User-Agent
- HTML-Response mit OG-Tags für Crawler (inkl. meta-refresh zur SPA)
- 302-Redirect für normale Browser
- JSON für API-Calls (bestehend)

**`src/pages/FlightDetail.tsx`:**
- Share-URL auf Edge-Function-URL umstellen: `${supabaseUrl}/functions/v1/get-shared-flight?token=${shareToken}`

**`src/pages/SharedFlightDetail.tsx`:**
- Keine Änderung nötig, bleibt als SPA-Ansicht

Zwei Dateien.

