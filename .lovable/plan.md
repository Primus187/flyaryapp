

# Fix: Share-Button funktioniert nicht

## Problem
1. Auf Mobile mit `navigator.share` wird der Fehler still verschluckt (`catch {}`) — kein Feedback
2. Wahrscheinlich fehlt `share_token` im Flight-Objekt, weil der Typ es nicht kennt und/oder die Migration für bestehende Flüge nicht gegriffen hat
3. Der `navigator.share()`-Aufruf braucht neben `url` auch `text` für bessere Kompatibilität

## Lösung in `src/pages/FlightDetail.tsx` (Zeilen 187-197)

1. **Fehler loggen statt verschlucken**: Im `catch`-Block einen Toast mit Fehlermeldung zeigen, und als Fallback den Link in die Zwischenablage kopieren
2. **Share-Aufruf verbessern**: `text`-Parameter hinzufügen für bessere WhatsApp-Darstellung
3. **Fallback bei fehlendem Token**: Falls `share_token` null ist, zuerst per Supabase-Update einen generieren (`gen_random_uuid()`) und dann verwenden
4. **Toast nach erfolgreichem Share**: Auch nach `navigator.share()` eine Bestätigung zeigen

```typescript
<Button variant="ghost" size="icon" onClick={async () => {
  try {
    let shareToken = (flight as any).share_token;
    if (!shareToken) {
      // Generate token on-the-fly for old flights
      const { data: updated, error } = await supabase
        .from("flights")
        .update({ share_token: crypto.randomUUID() } as any)
        .eq("id", id)
        .select("share_token")
        .single();
      if (error || !updated) {
        toast({ title: "Fehler beim Erstellen des Share-Links", variant: "destructive" });
        return;
      }
      shareToken = (updated as any).share_token;
      setFlight({ ...flight, share_token: shareToken } as any);
    }
    const url = `${window.location.origin}/shared/flights/${shareToken}`;
    if (navigator.share) {
      await navigator.share({
        title: flight.takeoff?.name || "Flug",
        text: `Schau dir diesen Flug an!`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link kopiert!" });
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      // Fallback: copy to clipboard
      const token = (flight as any).share_token;
      if (token) {
        const url = `${window.location.origin}/shared/flights/${token}`;
        await navigator.clipboard.writeText(url);
        toast({ title: "Link kopiert!" });
      }
    }
  }
}}>
```

Eine Datei, ein Block.

