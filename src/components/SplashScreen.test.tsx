import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SplashScreen from "./SplashScreen";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("finishes after the minimum duration and exit animation", () => {
  vi.useFakeTimers();
  const finished = vi.fn();
  render(<SplashScreen onFinished={finished} ready />);
  act(() => vi.advanceTimersByTime(300));
  expect(finished).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(150));
  expect(finished).toHaveBeenCalledTimes(1);
});

it("waits for data readiness and cancels completion on unmount", () => {
  vi.useFakeTimers();
  const finished = vi.fn();
  const view = render(<SplashScreen onFinished={finished} ready={false} />);
  act(() => vi.advanceTimersByTime(2000));
  expect(finished).not.toHaveBeenCalled();
  view.rerender(<SplashScreen onFinished={finished} ready />);
  view.unmount();
  act(() => vi.advanceTimersByTime(150));
  expect(finished).not.toHaveBeenCalled();
});
