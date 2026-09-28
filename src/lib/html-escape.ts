/**
 * Text for HTML that the app writes itself (print windows opened with window.open). Such a window
 * shares the app's origin, so a name like `<img onerror=…>` would run with the viewer's session;
 * every value that goes into that HTML passes through here.
 */
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
