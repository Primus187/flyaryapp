import { renderHook, act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFlightDayLive } from "./use-flight-day-live";

const { channel, removeChannel, subscribed } = vi.hoisted(() => {
  const subscribed: { cb?: (status: string) => void } = {};
  const ch = { on: vi.fn(), subscribe: vi.fn((cb: (status: string) => void) => { subscribed.cb = cb; return ch; }) };
  ch.on.mockReturnValue(ch);
  return { channel: vi.fn(() => ch), removeChannel: vi.fn(), subscribed };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { channel, removeChannel } }));

afterEach(() => { vi.clearAllMocks(); });

it("reloads when the view's settings change (new reload function)", () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = renderHook(({ reload }) => useFlightDayLive("ev", reload, "test"), { initialProps: { reload: first } });
  expect(first).toHaveBeenCalledTimes(1);
  rerender({ reload: second });
  expect(second).toHaveBeenCalledTimes(1);
});

it("reloads after a Realtime reconnect, not on the first subscription", () => {
  const reload = vi.fn();
  renderHook(() => useFlightDayLive("ev", reload, "test"));
  act(() => { subscribed.cb?.("SUBSCRIBED"); });
  expect(reload).toHaveBeenCalledTimes(1);
  act(() => { subscribed.cb?.("CHANNEL_ERROR"); subscribed.cb?.("SUBSCRIBED"); });
  expect(reload).toHaveBeenCalledTimes(2);
});

it("reloads when the device is back online and removes its listeners", () => {
  const reload = vi.fn();
  const { unmount } = renderHook(() => useFlightDayLive("ev", reload, "test"));
  act(() => { window.dispatchEvent(new Event("online")); });
  expect(reload).toHaveBeenCalledTimes(2);
  unmount();
  expect(removeChannel).toHaveBeenCalled();
  window.dispatchEvent(new Event("online"));
  expect(reload).toHaveBeenCalledTimes(2);
});
