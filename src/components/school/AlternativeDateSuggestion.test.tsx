import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AlternativeDateSuggestion from "./AlternativeDateSuggestion";

const { from, navigate } = vi.hoisted(() => ({ from: vi.fn(), navigate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

function response(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "gt"]) query[method] = vi.fn().mockReturnValue(query);
  (query as unknown as { then: typeof result.then }).then = result.then.bind(result);
  from.mockReturnValueOnce(query);
  return query;
}

beforeEach(() => { from.mockReset(); navigate.mockReset(); });
afterEach(cleanup);

it("suggests dates where an available team member exists and navigates to a prefilled duplicate on click", async () => {
  response([{ user_id: "teacher", function: "instructor" }]); // group_member_functions
  response([
    { user_id: "teacher", date: "2026-09-23" },
    { user_id: "someone-else-not-on-team", date: "2026-09-24" },
  ]); // instructor_availability

  render(<AlternativeDateSuggestion eventId="evt1" groupId="school" eventDate="2026-09-21" />);

  const button = await screen.findByRole("button", { name: /23/ });
  expect(screen.queryByText(/24/)).not.toBeInTheDocument(); // availability from a non-team member doesn't count

  fireEvent.click(button);
  expect(navigate).toHaveBeenCalledWith("/events/new?duplicate=evt1&date=2026-09-23");
});

it("shows a hint instead of suggestions when nobody is available", async () => {
  response([]); // group_member_functions
  response([]); // instructor_availability

  render(<AlternativeDateSuggestion eventId="evt1" groupId="school" eventDate="2026-09-21" />);

  expect(await screen.findByText("events.alternativeDate.none")).toBeInTheDocument();
});

it("shows a hint instead of a crash when a query fails", async () => {
  response(null, { message: "offline" });
  response([]);

  render(<AlternativeDateSuggestion eventId="evt1" groupId="school" eventDate="2026-09-21" />);

  expect(await screen.findByText("events.alternativeDate.none")).toBeInTheDocument();
});
