import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = { upload: vi.fn(), remove: vi.fn() };
const insertResult = { data: null as unknown, error: null as unknown };
const deleteEq = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => storage },
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => insertResult }) }),
      delete: () => ({ eq: deleteEq }),
    }),
    rpc: vi.fn(),
  },
}));
const compressImage = vi.fn();
vi.mock("./image-compress", () => ({ compressImage: (...args: unknown[]) => compressImage(...args) }));

import {
  ListingPhotoError, MAX_SOURCE_BYTES, checkSourceFile, deleteListingPhoto, movePhoto, photoPaths, photosThatFit,
  sortPhotos, uploadListingPhoto,
} from "./marketplace-photos";

const listing = "11111111-1111-4111-8111-111111111111";
const webp = (name: string) => new File(["x"], name, { type: "image/webp" });

describe("pure helpers", () => {
  it("checks the picked file", () => {
    expect(checkSourceFile({ type: "image/heic", size: 4_000_000 })).toBeNull();
    expect(checkSourceFile({ type: "application/pdf", size: 10 })).toBe("not_an_image");
    expect(checkSourceFile({ type: "image/jpeg", size: MAX_SOURCE_BYTES + 1 })).toBe("too_large");
  });
  it("counts how many picked photos still fit", () => {
    expect(photosThatFit(0, 8)).toBe(6);
    expect(photosThatFit(4, 3)).toBe(2);
    expect(photosThatFit(6, 1)).toBe(0);
  });
  it("builds paths inside the listing folder", () => {
    expect(photoPaths(listing, "p1", "image/webp")).toEqual({ path: `${listing}/p1.webp`, thumb_path: `${listing}/p1_thumb.webp` });
    expect(photoPaths(listing, "p1", "image/jpeg").path).toBe(`${listing}/p1.jpg`);
  });
  it("moves a photo and ignores invalid moves", () => {
    expect(movePhoto(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(movePhoto(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(movePhoto(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
  it("sorts by position", () => {
    expect(sortPhotos([{ position: 2 }, { position: 0 }, { position: 1 }]).map((p) => p.position)).toEqual([0, 1, 2]);
  });
});

describe("uploadListingPhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.upload.mockResolvedValue({ error: null });
    storage.remove.mockResolvedValue({ error: null });
    compressImage.mockImplementation(async () => webp("x.webp"));
    insertResult.data = null;
    insertResult.error = null;
  });

  it("uploads image and thumbnail, then records the photo", async () => {
    insertResult.data = { id: "p", listing_id: listing, path: "a", thumb_path: "b", position: 0 };
    await expect(uploadListingPhoto(listing, new File(["x"], "IMG.jpg", { type: "image/jpeg" }), 0)).resolves.toMatchObject({ id: "p" });
    expect(compressImage.mock.calls.map((c) => c[1])).toEqual([1280, 320]);
    const paths = storage.upload.mock.calls.map((c) => c[0] as string);
    expect(paths).toHaveLength(2);
    expect(paths[0]).toMatch(new RegExp(`^${listing}/[0-9a-f-]{36}\\.webp$`));
    expect(paths[1]).toBe(paths[0].replace(".webp", "_thumb.webp"));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("removes uploaded files when recording fails, and maps the photo limit", async () => {
    insertResult.error = { message: "a listing has at most 6 photos" };
    await expect(uploadListingPhoto(listing, webp("a.webp"), 5)).rejects.toMatchObject({ code: "too_many" });
    expect(storage.remove).toHaveBeenCalledWith(storage.upload.mock.calls.map((c) => c[0]));
  });

  it("removes the image when the thumbnail upload fails", async () => {
    storage.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "quota" } });
    await expect(uploadListingPhoto(listing, webp("a.webp"), 0)).rejects.toMatchObject({ code: "upload_failed" });
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]]);
  });

  it("refuses files the browser could not convert, before uploading anything", async () => {
    compressImage.mockImplementation(async (f: File) => f);
    await expect(uploadListingPhoto(listing, new File(["x"], "a.heic", { type: "image/heic" }), 0))
      .rejects.toEqual(new ListingPhotoError("unsupported_format"));
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("refuses a 7th position and non-images without compressing", async () => {
    await expect(uploadListingPhoto(listing, webp("a.webp"), 6)).rejects.toMatchObject({ code: "too_many" });
    await expect(uploadListingPhoto(listing, new File(["x"], "a.txt", { type: "text/plain" }), 0)).rejects.toMatchObject({ code: "not_an_image" });
    expect(compressImage).not.toHaveBeenCalled();
  });
});

describe("deleteListingPhoto", () => {
  it("removes both files before the record", async () => {
    storage.remove.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: null });
    await deleteListingPhoto({ id: "p", path: "l/p.webp", thumb_path: "l/p_thumb.webp" });
    expect(storage.remove).toHaveBeenCalledWith(["l/p.webp", "l/p_thumb.webp"]);
    expect(deleteEq).toHaveBeenCalledWith("id", "p");
  });
  it("keeps the record when the files cannot be removed", async () => {
    deleteEq.mockClear();
    storage.remove.mockResolvedValue({ error: { message: "denied" } });
    await expect(deleteListingPhoto({ id: "p", path: "a", thumb_path: "b" })).rejects.toBeTruthy();
    expect(deleteEq).not.toHaveBeenCalled();
  });
});
