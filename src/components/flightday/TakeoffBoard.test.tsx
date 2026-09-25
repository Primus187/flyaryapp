import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TakeoffBoard from "./TakeoffBoard";

const { from, rpc, channel, removeChannel, tables } = vi.hoisted(() => {
  const ch = { on: vi.fn(), subscribe: vi.fn() };
  ch.on.mockReturnValue(ch);
  ch.subscribe.mockReturnValue(ch);
  const tables: Record<string, unknown[]> = {};
  const from = vi.fn((table: string) => {
    const result = Promise.resolve({ data: tables[table] ?? [], error: null });
    const query: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "is", "neq", "order", "maybeSingle"]) query[m] = vi.fn().mockReturnValue(query);
    query.then = result.then.bind(result);
    return query;
  });
  return { from, rpc: vi.fn(), channel: vi.fn(() => ch), removeChannel: vi.fn(), tables };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc, channel, removeChannel } }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o?.number ? `${key} ${o.number}` : key), i18n: { language: "de" } }),
}));

const signups = [{ user_id: "anna", presence: "present" as const }, { user_id: "beat", presence: "present" as const }];
const profiles = { anna: "Anna", beat: "Beat" };

beforeEach(() => {
  rpc.mockReset(); toast.mockReset();
  for (const k of Object.keys(tables)) delete tables[k];
  tables.event_school_flights = [
    { id: "f1", student_user_id: "anna", seq: 1, status: "landed", started_at: "2026-09-25T09:00:00Z", landed_at: "2026-09-25T09:12:00Z", start_note: null },
    { id: "f2", student_user_id: "anna", seq: 2, status: "in_air", started_at: "2026-09-25T09:40:00Z", landed_at: null, start_note: null },
  ];
  tables.event_school_flight_notes = [{ flight_id: "f1", feedback: "Anflug sauber", internal_note: null }];
  tables.event_maneuvers = [{ training_item_id: "launch", sort_order: 1 }];
  tables.training_items = [{ id: "launch", name: "Aufziehen" }];
});
afterEach(cleanup);

it("starts a student on the ground and shows abort while in the air", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  render(<TakeoffBoard eventId="ev" signups={signups} profiles={profiles} />);
  expect(await screen.findByRole("button", { name: "flightDay.takeoff.abort" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "flightDay.takeoff.start" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("school_flight_start", { _event_id: "ev", _student_id: "beat" }));
});

it("records an aborted launch with a reason", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  render(<TakeoffBoard eventId="ev" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.takeoff.abort" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "flightDay.takeoff.noteLabel" }), { target: { value: "Aufziehen asymmetrisch" } });
  fireEvent.click(screen.getByRole("button", { name: "flightDay.takeoff.abortSave" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("school_flight_abort", { _flight_id: "f2", _note: "Aufziehen asymmetrisch" }));
});

it("asks before starting a paused student and shows no feedback", async () => {
  tables.event_day_pauses = [{ student_user_id: "beat", reason: "fatigue", note: null }];
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<TakeoffBoard eventId="ev" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.takeoff.start" }));
  expect(confirm).toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
  expect(screen.queryByText("Anflug sauber")).not.toBeInTheDocument();
  confirm.mockRestore();
});

it("shows a closed day without start or abort", async () => {
  render(<TakeoffBoard eventId="ev" signups={signups} profiles={profiles} readOnly />);
  expect(await screen.findByText("Beat")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "flightDay.takeoff.start" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "flightDay.takeoff.abort" })).not.toBeInTheDocument();
});
