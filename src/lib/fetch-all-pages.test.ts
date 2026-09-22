import { expect, it, vi } from "vitest";
import { fetchAllPages } from "./fetch-all-pages";

it("continues through a server row cap lower than the requested page size", async () => {
  const fetch = vi.fn(async (from: number) => ({ data: [from, from + 1], count: 6, error: null }));
  expect(await fetchAllPages(fetch)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(fetch.mock.calls.map(([offset]) => offset)).toEqual([0, 2, 4]);
});

it("does not return partial results after a failed batch", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ data: [1], count: 2, error: null }).mockResolvedValueOnce({ data: null, count: null, error: new Error("offline") });
  await expect(fetchAllPages(fetch)).rejects.toThrow("offline");
});
