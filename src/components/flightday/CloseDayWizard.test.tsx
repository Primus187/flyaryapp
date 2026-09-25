import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CloseDayWizard from "./CloseDayWizard";
import DayCloseBar from "./DayCloseBar";
import type { ClosePreview } from "@/lib/flight-day-close";

const { from, rpc, state } = vi.hoisted(() => {
  const state: { event: Record<string, unknown> | null } = { event: null };
  const from = vi.fn((table: string) => {
    const data = table === "flight_events" ? state.event : table === "profiles" ? { pilot_name: "Iris" } : null;
    const result = Promise.resolve({ data, error: null });
    const query: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "maybeSingle", "upsert"]) query[m] = vi.fn().mockReturnValue(query);
    query.then = result.then.bind(result);
    return query;
  });
  return { from, rpc: vi.fn(), state };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } }) }));

const base: ClosePreview = {
  closedAt: null, closedBy: null, inAir: [], expected: [], missingTakeoff: 0, defaultTakeoff: null,
  summaries: [{ studentId: "anna", hasSummary: true, feedback: [] }],
  loans: [{ id: "loan1", userId: "anna", equipment: "Schulschirm M", inventoryNumber: "S-1", assignedOn: "2026-09-25" }],
  creditRate: 50, rentalRate: 30,
  credits: [{ userId: "helper", booked: false }],
  rentals: [{ userId: "anna", hasLoan: true, booked: false }, { userId: "beat", hasLoan: false, booked: false }],
};
const profiles = { anna: "Anna", beat: "Beat", helper: "Hugo" };
const mockRpc = (preview: ClosePreview) => rpc.mockImplementation((name: string) =>
  Promise.resolve(name === "flight_day_close_preview"
    ? { data: preview, error: null }
    : { data: { credits: 1, items: 1, returned: 1, notified: 1 }, error: null }));
const next = () => fireEvent.click(screen.getByRole("button", { name: "flightDay.close.next" }));

beforeEach(() => { rpc.mockReset(); toast.mockReset(); state.event = null; });
afterEach(cleanup);

it("walks through the steps and closes with returns, credits and rentals only for loans", async () => {
  mockRpc(base);
  const onClosed = vi.fn();
  render(<CloseDayWizard eventId="ev" open profiles={profiles} onOpenChange={vi.fn()} onClosed={onClosed} />);
  expect(await screen.findByText("flightDay.close.allLanded")).toBeInTheDocument();
  next(); next();
  fireEvent.click(await screen.findByText("Schulschirm M"));
  next();
  fireEvent.click(screen.getByRole("button", { name: "flightDay.close.confirm" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("close_flight_day", {
    _event_id: "ev", _credit_user_ids: ["helper"], _rental_user_ids: ["anna"], _return_assignment_ids: ["loan1"],
  }));
  await waitFor(() => expect(onClosed).toHaveBeenCalled());
});

it("does not close while someone is in the air", async () => {
  mockRpc({ ...base, inAir: [{ flightId: "f", studentId: "anna" }] });
  render(<CloseDayWizard eventId="ev" open profiles={profiles} onOpenChange={vi.fn()} onClosed={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("flightDay.close.inAir");
  next(); next(); next();
  expect(screen.getByRole("button", { name: "flightDay.close.confirm" })).toBeDisabled();
});

it("offers a summary suggestion from the day's feedback", async () => {
  mockRpc({ ...base, summaries: [{ studentId: "beat", hasSummary: false, feedback: ["Start sauber", "Anflug zu spät"] }] });
  render(<CloseDayWizard eventId="ev" open profiles={profiles} onOpenChange={vi.fn()} onClosed={vi.fn()} />);
  await screen.findByText("flightDay.close.allLanded");
  next();
  expect(await screen.findByRole("textbox", { name: "flightDay.summary.title" })).toHaveValue("F1: Start sauber\nF2: Anflug zu spät");
});

it("shows a closed day with who closed it and reopens after confirmation", async () => {
  state.event = { day_closed_at: "2026-09-25T17:00:00Z", day_closed_by: "teacher" };
  rpc.mockResolvedValue({ data: null, error: null });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const onChanged = vi.fn();
  render(<DayCloseBar eventId="ev" eventDate="2026-09-25T08:00:00Z" profiles={profiles} onChanged={onChanged} />);
  expect(await screen.findByText(/flightDay.close.closedAt/)).toHaveTextContent("Iris");
  fireEvent.click(screen.getByRole("button", { name: "flightDay.close.reopen" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("reopen_flight_day", { _event_id: "ev" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

it("offers closing only once the day has begun", async () => {
  render(<DayCloseBar eventId="ev" eventDate="2099-01-01T08:00:00Z" profiles={profiles} onChanged={vi.fn()} />);
  await waitFor(() => expect(from).toHaveBeenCalledWith("flight_events"));
  expect(screen.queryByRole("button", { name: "flightDay.close.open" })).not.toBeInTheDocument();
});
