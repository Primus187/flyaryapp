/**
 * YouTube links of flights. Only https/http addresses on YouTube's own hosts count: anything else
 * (e.g. "javascript:…", stored through the API) is neither embedded nor linked. The database checks
 * the same hosts (migration 0068, flight_videos_youtube_url_check).
 */
const HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/;

function parse(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return HOSTS.has(url.hostname.replace(/^www\./, "")) ? url : null;
  } catch {
    return null;
  }
}

export const isYoutubeUrl = (raw: string | null | undefined): boolean => !!raw && parse(raw) !== null;

export function youtubeVideoId(raw: string | null | undefined): string | null {
  const url = raw ? parse(raw) : null;
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (url.pathname === "/watch") id = url.searchParams.get("v");
  else if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
  return id && VIDEO_ID.test(id) ? id : null;
}

export function youtubeEmbedUrl(raw: string | null | undefined): string | null {
  const id = youtubeVideoId(raw);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** The address itself, for a plain link, only when it is a YouTube address. */
export const youtubeLink = (raw: string | null | undefined): string | undefined => (raw && isYoutubeUrl(raw) ? raw.trim() : undefined);
