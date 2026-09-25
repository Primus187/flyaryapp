import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SchoolFlightImportCard from "./SchoolFlightImportCard";
import type { ImportDay } from "@/lib/school-flight-match";

const { rpc, state } = vi.hoisted(() => {
  const state: { days: unknown[] } = { days: [] };
  const rpc = vi.fn((name: string) => Promise.resolve(name === "my_school_flight_imports"
    ? { data: state.days, error: null }
    : { data: { created: 2, linked: 0 }, error: null }));
  return { rpc, state };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "anna" } }) }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } }) }));

const day = (candidates: ImportDay["candidates"] = []): ImportDay => ({
  eventId: "ev", title: "Höhenflüge", date: "2026-09-25", groupId: "school",
  flights: [
    { id: "s1", number: 1, startedAt: "2026-09-25T09:00:00Z", landedAt: "2026-09-25T09:14:00Z", takeoff: "Niederbauen", landing: "Emmetten" },
    { id: "s2", number: 2, startedAt: null, landedAt: "2026-09-25T10:00:00Z", takeoff: "Niederbauen", landing: "Emmetten" },
  ],
  candidates,
});
const renderCard = () => render(<QueryClientProvider client={new QueryClient()}><SchoolFlightImportCard /></QueryClientProvider>);

beforeEach(() => { rpc.mockClear(); toast.mockReset(); state.days = []; });
afterEach(cleanup);

it("shows nothing without school flights to take over", async () => {
  renderCard();
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("my_school_flight_imports"));
  expect(screen.queryByText("schoolImport.takeOver")).not.toBeInTheDocument();
});

it("takes all flights over with one tap when there is nothing to link", async () => {
  state.days = [day()];
  renderCard();
  fireEvent.click(await screen.findByRole("button", { name: "schoolImport.takeOver" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("import_school_flights", {
    _event_id: "ev", _links: [{ schoolFlightId: "s1", flightId: null }, { schoolFlightId: "s2", flightId: null }],
  }));
  expect(toast).toHaveBeenCalledWith({ title: "schoolImport.done" });
});

it("suggests linking an own entry of that day before taking over", async () => {
  state.days = [day([{ id: "own", createdAt: "2026-09-25T18:00:00Z", durationMinutes: 12, takeoff: "Niederbauen" }])];
  renderCard();
  fireEvent.click(await screen.findByRole("button", { name: "schoolImport.takeOver" }));
  expect(await screen.findByText("schoolImport.dialogTitle")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "schoolImport.confirm" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("import_school_flights", {
    _event_id: "ev", _links: [{ schoolFlightId: "s1", flightId: "own" }, { schoolFlightId: "s2", flightId: null }],
  }));
});

it("hides a day with 'not now'", async () => {
  state.days = [day()];
  renderCard();
  fireEvent.click(await screen.findByRole("button", { name: "schoolImport.dismiss" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("dismiss_school_flight_import", { _event_id: "ev" }));
});
