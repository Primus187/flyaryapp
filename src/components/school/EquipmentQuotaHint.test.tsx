import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EquipmentQuotaHint from "./EquipmentQuotaHint";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, args?: { needed: number; available: number }) => args?.needed ? `${key} ${args.available}/${args.needed}` : key }) }));

function response(data: unknown[], error: unknown = null, count = data.length) {
  const result = Promise.resolve({ data, error, count });
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), neq: vi.fn(), lt: vi.fn(), lte: vi.fn(), or: vi.fn(), then: result.then.bind(result) };
  for (const method of [query.select, query.eq, query.in, query.neq, query.lt, query.lte, query.or]) method.mockReturnValue(query);
  from.mockReturnValueOnce(query);
  return query;
}
function load({ error = false, truncated = false } = {}) {
  response([{ user_id: "student", role: "member" }]);
  response([]);
  const attendance = response([]);
  response([], error ? { message: "offline" } : null, truncated ? 10 : 0);
  response([]);
  return attendance;
}
const signups = [{ user_id: "student", signed_up: true, status: "confirmed" }];
beforeEach(() => from.mockReset());
afterEach(cleanup);

it("checks only prior attended basic courses in the selected school", async () => {
  const attendance = load();
  render(<EquipmentQuotaHint groupId="school" eventDate="2026-09-21" signups={signups} />);
  expect(await screen.findByText("school.quota.warning 0/1")).toBeInTheDocument();
  expect(attendance.eq).toHaveBeenCalledWith("attended", true);
  expect(attendance.eq).toHaveBeenCalledWith("flight_events.group_id", "school");
  expect(attendance.eq).toHaveBeenCalledWith("flight_events.event_category", "basic_course");
  expect(attendance.lt).toHaveBeenCalledWith("flight_events.event_date", "2026-09-21");
});

it.each([{ error: true }, { truncated: true }])("shows unknown availability for incomplete queries: %j", async (failure) => {
  load(failure);
  render(<EquipmentQuotaHint groupId="school" eventDate="2026-09-21" signups={signups} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("school.quota.loadFailed");
  expect(screen.queryByText("school.quota.warning 0/1")).not.toBeInTheDocument();
});

it("recalculates after a signup is withdrawn", async () => {
  load();
  const { rerender } = render(<EquipmentQuotaHint groupId="school" eventDate="2026-09-21" signups={signups} />);
  await screen.findByText("school.quota.warning 0/1");
  load();
  rerender(<EquipmentQuotaHint groupId="school" eventDate="2026-09-21" signups={[{ ...signups[0], signed_up: false }]} />);
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
});
