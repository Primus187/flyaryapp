import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DayCheckIn from "./DayCheckIn";

const { from, rpc, channel, removeChannel } = vi.hoisted(() => {
  const ch = { on: vi.fn(), subscribe: vi.fn() };
  ch.on.mockReturnValue(ch);
  ch.subscribe.mockReturnValue(ch);
  return { from: vi.fn(), rpc: vi.fn(), channel: vi.fn(() => ch), removeChannel: vi.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc, channel, removeChannel } }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function pauses(data: unknown[]) {
  const result = Promise.resolve({ data, error: null });
  const query: Record<string, unknown> = {};
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.then = result.then.bind(result);
  from.mockReturnValue(query);
}

const signups = [
  { user_id: "anna", presence: "expected" as const },
  { user_id: "beat", presence: "present" as const },
];
const profiles = { anna: "Anna", beat: "Beat" };

beforeEach(() => { from.mockReset(); rpc.mockReset(); toast.mockReset(); });
afterEach(cleanup);

it("checks a student in with one tap and reloads the signups", async () => {
  pauses([]);
  rpc.mockResolvedValue({ data: "present", error: null });
  const onChanged = vi.fn();
  render(<DayCheckIn eventId="ev" signups={signups} profiles={profiles} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: "Anna: flightDay.status.expected" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(rpc).toHaveBeenCalledWith("set_signup_presence", { _event_id: "ev", _student_id: "anna", _presence: "present" });
});

it("undoes a check-in on a second tap", async () => {
  pauses([]);
  rpc.mockResolvedValue({ data: "expected", error: null });
  render(<DayCheckIn eventId="ev" signups={signups} profiles={profiles} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Beat: flightDay.status.present" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("set_signup_presence", { _event_id: "ev", _student_id: "beat", _presence: "expected" }));
});

it("shows the pause reason instead of the status and reports a closed day", async () => {
  pauses([{ student_user_id: "beat", reason: "injury", note: null }]);
  rpc.mockResolvedValue({ data: null, error: { message: "Flight day is closed" } });
  const onChanged = vi.fn();
  render(<DayCheckIn eventId="ev" signups={signups} profiles={profiles} onChanged={onChanged} />);
  expect(await screen.findByText("flightDay.reasons.injury")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Anna: flightDay.status.expected" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: "flightDay.closed", variant: "destructive" }));
  expect(onChanged).not.toHaveBeenCalled();
});

it("checks in everyone still open after confirmation", async () => {
  pauses([]);
  rpc.mockResolvedValue({ data: 1, error: null });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DayCheckIn eventId="ev" signups={signups} profiles={profiles} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "flightDay.allPresent" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("set_signups_present", { _event_id: "ev", _student_ids: ["anna"] }));
});
