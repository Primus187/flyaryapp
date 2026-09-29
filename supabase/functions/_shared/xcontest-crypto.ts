// Encryption of stored XContest passwords (profiles.xcontest_password_encrypted).
// Format: "v1:" + Base64(12-byte IV || AES-256-GCM ciphertext and tag). The key is SHA-256 of the
// XCONTEST_ENCRYPTION_KEY secret; the user id is bound as additional data, so a value copied to
// another profile does not decrypt. Values without the prefix are legacy Base64 plaintext written
// by the former client-side btoa(). Web Crypto only, so Deno (edge function), Node and Vitest share it.
const PREFIX = "v1:";
const encoder = new TextEncoder();

async function aesKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("XCONTEST_ENCRYPTION_KEY is not configured");
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export const isEncryptedPassword = (stored: string) => stored.startsWith(PREFIX);

export async function encryptPassword(password: string, userId: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(userId) },
    await aesKey(secret),
    encoder.encode(password),
  );
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), iv.length);
  return PREFIX + toBase64(out);
}

export async function decryptPassword(stored: string, userId: string, secret: string): Promise<string> {
  if (!isEncryptedPassword(stored)) return atob(stored);
  const data = fromBase64(stored.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.slice(0, 12), additionalData: encoder.encode(userId) },
    await aesKey(secret),
    data.slice(12),
  );
  return new TextDecoder().decode(plain);
}
