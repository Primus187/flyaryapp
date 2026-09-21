import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EventWeatherDecision from "./EventWeatherDecision";

const { from, functionsInvoke, toast } = vi.hoisted(() => ({ from: vi.fn(), functionsInvoke: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, functions: { invoke: functionsInvoke } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function response(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "upsert", "update", "maybeSingle"]) query[method] = vi.fn().mockReturnValue(query);
  (query as unknown as { then: typeof result.then }).then = result.then.bind(result);
  from.mockReturnValueOnce(query);
  return query;
}

beforeEach(() => { from.mockReset(); functionsInvoke.mockReset().mockResolvedValue({ error: null }); toast.mockReset(); });
afterEach(cleanup);

it("shows nothing to a non-staff viewer when no decision has been recorded yet", async () => {
  response(null);
  const { container } = render(<EventWeatherDecision eventId="e1" groupId="school" eventTitle="Termin" canManage={false} />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

it("shows an existing decision's status to a non-staff viewer", async () => {
  response({ decision_deadline: null, status: "confirmed", decided_at: "2026-06-01T00:00:00Z", note: null });
  render(<EventWeatherDecision eventId="e1" groupId="school" eventTitle="Termin" canManage={false} />);
  expect(await screen.findByText("events.weatherDecision.status.confirmed")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "events.weatherDecision.edit" })).not.toBeInTheDocument();
});

it("saves a note-only edit without notifying participants, since the status did not change", async () => {
  response({ decision_deadline: null, status: "weather_pending", decided_at: "2026-06-01T00:00:00Z", note: "alt" });
  render(<EventWeatherDecision eventId="e1" groupId="school" eventTitle="Termin" canManage={true} />);

  fireEvent.click(await screen.findByRole("button", { name: "events.weatherDecision.edit" }));
  fireEvent.change(screen.getByLabelText("events.weatherDecision.noteLabel"), { target: { value: "neu" } });
  const upsertQuery = response({});
  response({ decision_deadline: null, status: "weather_pending", decided_at: "2026-06-01T00:00:00Z", note: "neu" }); // reload after save

  fireEvent.click(screen.getByRole("button", { name: "common.save" }));

  await waitFor(() => expect(upsertQuery.upsert).toHaveBeenCalled());
  const [payload] = upsertQuery.upsert.mock.calls[0];
  expect(payload.note).toBe("neu");
  expect(payload.decided_by).toBeUndefined();
  expect(functionsInvoke).not.toHaveBeenCalled();
});
