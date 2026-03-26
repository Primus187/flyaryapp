import { supabase } from "@/integrations/supabase/client";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 50 * 60 * 1000; // 50 min (URLs valid 60 min)

export async function getSignedUrl(bucket: string, path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const key = `${bucket}:${path}`;
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;

  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (data?.signedUrl) {
    cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + TTL });
    return data.signedUrl;
  }
  return "";
}

export async function getSignedUrls(bucket: string, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const result: Record<string, string> = {};
  const uncached: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    if (p.startsWith("http")) { result[p] = p; continue; }
    const key = `${bucket}:${p}`;
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      result[p] = entry.url;
    } else {
      uncached.push(p);
    }
  }

  if (uncached.length > 0) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(uncached, 3600);
    data?.forEach(s => {
      if (s.signedUrl) {
        cache.set(`${bucket}:${s.path}`, { url: s.signedUrl, expiresAt: Date.now() + TTL });
        result[s.path] = s.signedUrl;
      }
    });
  }

  return result;
}

export function clearSignedUrlCache() {
  cache.clear();
}
