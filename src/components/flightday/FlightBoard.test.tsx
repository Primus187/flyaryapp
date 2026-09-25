import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FlightBoard from "./FlightBoard";

const { from, rpc, channel, removeChannel, tables } = vi.hoisted(() => {
  const ch = { on: vi.fn(), subscribe: vi.fn() };
  ch.on.mockReturnValue(ch);
  ch.subscribe.mockReturnValue(ch);
  const tables: Record<string, unknown[]> = {};
  const from = vi.fn((table: string) => {
    const result = Promise.resolve({ data: tables[table] ?? [], error: null });
    const query: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "is", "neq", "order", "maybeSingle", "upsert", "gte", "lte"]) query[m] = vi.fn().mockReturnValue(query);
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

it("offers landing for a student in the air and saves landing, feedback and ratings in one call", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.board.land" }));
  const group = await screen.findByRole("group", { name: "Aufziehen" });
  fireEvent.click(within(group).getByRole("button", { name: "flightDay.sheet.ratings.3" }));
  fireEvent.click(screen.getByRole("button", { name: "flightDay.snippets.flareGood" }));
  fireEvent.click(screen.getByRole("button", { name: "flightDay.sheet.save" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("school_flight_land", {
    _flight_id: "f2", _notes: { feedback: "flightDay.snippets.flareGood", internal_note: "" }, _items: [{ item_id: "launch", rating: 3 }],
  }));
});

it("records a new flight for a student on the ground", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.board.add" }));
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.sheet.save" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("school_flight_add", expect.objectContaining({ _event_id: "ev", _student_id: "beat" })));
});

it("counts a practice-slope flight with one tap and offers undo", async () => {
  rpc.mockResolvedValue({ data: { id: "new" }, error: null });
  render(<FlightBoard eventId="ev" eventCategory="basic_course" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.board.count" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("school_flight_add", { _event_id: "ev", _student_id: "beat" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "flightDay.board.counted 1" })));
});

it("shows the day's flights of a student with times and feedback", async () => {
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByText("Anna"));
  expect(await screen.findByText("Anflug sauber")).toBeInTheDocument();
  expect(screen.getByText("flightDay.board.flightN 1")).toBeInTheDocument();
  expect(screen.getByText("flightDay.board.flightN 2")).toBeInTheDocument();
});

it("reports a closed day instead of saving", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "Flight day is closed" } });
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.board.add" }));
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.sheet.save" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: "flightDay.errors.closed", variant: "destructive" }));
});

it("lets the instructor record a start reported by radio", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: "flightDay.board.start" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("school_flight_start", { _event_id: "ev", _student_id: "beat" }));
});

it("opens the landing sheet from the in-the-air bar", async () => {
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByRole("button", { name: /flightDay\.inAir\.entry/ }));
  expect(await screen.findByText("flightDay.sheet.titleLand 2")).toBeInTheDocument();
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));

it("lets staff write the day summary and mark it as next step, offering the last step only as a template", async () => {
  tables.student_day_notes = [];
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} canWriteSummary />);
  fireEvent.click(await screen.findByText("Beat"));
  const box = await screen.findByRole("textbox", { name: "flightDay.summary.title" });
  expect(box).toHaveValue("");
  fireEvent.change(box, { target: { value: "Anflug früher planen" } });
  fireEvent.click(screen.getByRole("button", { name: "flightDay.summary.nextStep" }));
  fireEvent.blur(box);
  const upsertCall = () => from.mock.results
    .map((r) => (r.value as { upsert: ReturnType<typeof vi.fn> }).upsert.mock.calls[0]?.[0])
    .find(Boolean);
  await waitFor(() => expect(upsertCall()).toBeDefined());
  expect(upsertCall()).toMatchObject({ note: "Anflug früher planen", is_next_step: true, visible_to_student: true, flight_number: null, student_user_id: "beat", event_id: "ev" });
});

it("hides the summary editor from instructors who only read the day", async () => {
  render(<FlightBoard eventId="ev" eventCategory="height_flight" signups={signups} profiles={profiles} />);
  fireEvent.click(await screen.findByText("Beat"));
  expect(screen.queryByRole("textbox", { name: "flightDay.summary.title" })).not.toBeInTheDocument();
});
