/**
 * An .igc file shared into the installed app from Android's share sheet. The service worker
 * (public/share-target-sw.js) parks it in Cache Storage; the new-flight form takes it from there once.
 */
const SHARE_CACHE = "flyary-share-target";
const SHARED_IGC_KEY = "/shared-file/igc";

/** The shared file, once (removed on reading); null when there is none or Cache Storage is unavailable. */
export async function takeSharedIgcFile(): Promise<File | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(SHARED_IGC_KEY);
    if (!res) return null;
    await cache.delete(SHARED_IGC_KEY);
    let name = "flight.igc";
    try { name = decodeURIComponent(res.headers.get("X-File-Name") || "") || name; } catch { /* keep default */ }
    return new File([await res.text()], name, { type: "text/plain" });
  } catch { return null; }
}
