/**
 * Compress and resize an image file before upload.
 *
 * Outputs WebP by default (smaller than JPEG at equivalent quality, supported
 * by all modern browsers). Falls back to JPEG if the browser cannot encode WebP
 * (extremely rare — only ancient browsers).
 *
 * The returned File keeps the original base name but with a `.webp` (or `.jpg`)
 * extension, and the correct MIME type so Supabase Storage serves it properly.
 */

let webpSupportCache: boolean | null = null;

function canEncodeWebP(): Promise<boolean> {
  if (webpSupportCache !== null) return Promise.resolve(webpSupportCache);
  return new Promise((resolve) => {
    try {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      c.toBlob(
        (b) => {
          webpSupportCache = !!b && b.type === "image/webp";
          resolve(webpSupportCache);
        },
        "image/webp",
        0.8
      );
    } catch {
      webpSupportCache = false;
      resolve(false);
    }
  });
}

export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<File> {
  const supportsWebP = await canEncodeWebP();
  const targetType = supportsWebP ? "image/webp" : "image/jpeg";
  const targetExt = supportsWebP ? ".webp" : ".jpg";

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only downscale, never upscale
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], baseName + targetExt, { type: targetType }));
        },
        targetType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // If decoding fails, return original file
      resolve(file);
    };

    img.src = url;
  });
}
