import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StudentDayFeedback from "./StudentDayFeedback";

const { from, rpc, state } = vi.hoisted(() => {
  const state: { notes: unknown[]; flights: unknown; released: boolean } = { notes: [], flights: [], released: true };
  const from = vi.fn(() => {
    const result = Promise.resolve({ data: state.notes, error: null });
    const query: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) query[m] = vi.fn().mockReturnValue(query);
    query.then = result.then.bind(result);
    return query;
  });
  const rpc = vi.fn((name: string) => Promise.resolve({ data: name === "my_school_flights" ? state.flights : state.released, error: null }));
  return { from, rpc, state };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "anna" } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o?.number ? `${key} ${o.number}` : key), i18n: { language: "de" } }),
}));

beforeEach(() => { state.notes = []; state.flights = []; state.released = true; });
afterEach(cleanup);

it("tells the student to wait until the day is released", async () => {
  state.released = false;
  render(<StudentDayFeedback eventId="ev" />);
  expect(await screen.findByText("flightDay.student.notYet")).toBeInTheDocument();
});

it("shows released school flights with rated maneuvers, feedback and the day summary", async () => {
  state.flights = [{ id: "f1", number: 1, startedAt: "2026-09-25T09:00:00Z", landedAt: "2026-09-25T09:12:00Z", takeoff: "Niederbauen", landing: "Emmetten",
    feedback: "Anflug sauber", items: [{ name: "Aufziehen", rating: 3 }] }];
  state.notes = [{ flight_number: null, note: "Nächstes Mal Gegenanflug früher" }];
  render(<StudentDayFeedback eventId="ev" />);
  expect(await screen.findByText("flightDay.board.flightN 1")).toBeInTheDocument();
  expect(screen.getByText("Anflug sauber")).toBeInTheDocument();
  expect(screen.getByText(/Aufziehen: flightDay.sheet.ratings.3/)).toBeInTheDocument();
  expect(screen.getByText("Nächstes Mal Gegenanflug früher")).toBeInTheDocument();
  expect(screen.getByText(/Niederbauen → Emmetten/)).toBeInTheDocument();
});
