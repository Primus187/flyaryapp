import { afterEach, describe, expect, it, vi } from "vitest";
import { takeSharedIgcFile } from "./shared-igc";

function fakeCaches(initial?: Response) {
  const store = new Map<string, Response>();
  if (initial) store.set("/shared-file/igc", initial);
  const cache = {
    match: async (key: string) => store.get(key),
    delete: async (key: string) => store.delete(key),
  };
  vi.stubGlobal("caches", { open: async () => cache });
  return store;
}

// jsdom's File has no .text(); the form reads it with FileReader too.
const readText = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.readAsText(file);
});

describe("takeSharedIgcFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parked file once, with its name", async () => {
    const store = fakeCaches(new Response("AXCT123\nB1200004700000N00800000EA0100001000", { headers: { "X-File-Name": encodeURIComponent("Fiesch 27.9.igc") } }));
    const file = await takeSharedIgcFile();
    expect(file?.name).toBe("Fiesch 27.9.igc");
    expect(await readText(file!)).toContain("B1200004700000N");
    expect(store.size).toBe(0);
    expect(await takeSharedIgcFile()).toBeNull();
  });

  it("falls back to a default name and copes with missing Cache Storage", async () => {
    fakeCaches(new Response("x", { headers: { "X-File-Name": "%E0%A4%A" } }));
    expect((await takeSharedIgcFile())?.name).toBe("flight.igc");
    vi.stubGlobal("caches", undefined);
    expect(await takeSharedIgcFile()).toBeNull();
  });
});
