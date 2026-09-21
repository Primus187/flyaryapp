import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeamAvailability from "./TeamAvailability";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.name ? `${key} ${opts.name}` : key) }) }));

function response(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "gte", "lte", "in", "upsert", "delete", "update", "single"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  (query as unknown as { then: typeof result.then }).then = result.then.bind(result);
  from.mockReturnValueOnce(query);
  return query;
}

function loadEmptyTeam() {
  response([]); // group_member_functions
  response([]); // instructor_availability
}

function loadOneInstructor(availability: unknown[] = []) {
  response([{ user_id: "teacher", function: "instructor" }]); // group_member_functions
  response(availability); // instructor_availability
  response([{ user_id: "teacher", pilot_name: "Alex" }]); // profiles
}

beforeEach(() => { from.mockReset(); });
afterEach(cleanup);

it("shows an empty state when the group has no team members", async () => {
  loadEmptyTeam();
  render(<TeamAvailability groupId="school" />);
  expect(await screen.findByText("school.availability.noTeam")).toBeInTheDocument();
});

it("renders each team member with their status per day, defaulting to none", async () => {
  loadOneInstructor();
  render(<TeamAvailability groupId="school" />);
  const names = await screen.findAllByText("Alex");
  expect(names).toHaveLength(7);
  expect(screen.getAllByText("school.availability.status.none")).toHaveLength(7);
});

it("cycles a person's status from none to available on click and writes it", async () => {
  loadOneInstructor();
  render(<TeamAvailability groupId="school" />);
  await screen.findAllByText("Alex");
  const upsertQuery = response({ id: "a1", status: "available", note: null });

  fireEvent.click(screen.getAllByText("school.availability.status.none")[0]);

  expect(await screen.findByText("school.availability.status.available")).toBeInTheDocument();
  expect(upsertQuery.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ group_id: "school", user_id: "teacher", status: "available" }),
    expect.anything(),
  );
});

it("shows a load error with a retry option instead of an empty team", async () => {
  response(null, { message: "offline" });
  render(<TeamAvailability groupId="school" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("school.availability.loadFailed");
  expect(screen.queryByText("school.availability.noTeam")).not.toBeInTheDocument();
});
