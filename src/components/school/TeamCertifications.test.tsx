import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeamCertifications from "./TeamCertifications";

const { from, toast } = vi.hoisted(() => ({ from: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function response(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error, count: Array.isArray(data) ? data.length : 1 });
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), gte: vi.fn(), lte: vi.fn(), upsert: vi.fn(), delete: vi.fn(), single: vi.fn(), then: result.then.bind(result) };
  for (const method of [query.select, query.eq, query.in, query.gte, query.lte, query.upsert, query.delete, query.single]) method.mockReturnValue(query);
  from.mockReturnValueOnce(query);
  return query;
}
function load() {
  response([{ user_id: "teacher", function: "instructor" }]);
  response([]);
  const staff = response([]);
  response([{ user_id: "teacher", pilot_name: "Alex" }]);
  return staff;
}
function fill(type: string, issuedAt = "2025-01-01", validUntil = "2028-01-01") {
  fireEvent.change(screen.getByLabelText(`school.certs.types.${type}: school.certs.issuedAt`), { target: { value: issuedAt } });
  fireEvent.change(screen.getByLabelText(`school.certs.types.${type}: school.certs.validUntil`), { target: { value: validUntil } });
}
beforeEach(() => { from.mockReset(); toast.mockReset(); });
afterEach(cleanup);

it("restricts teaching data to confirmed instructor assignments and shows missing dates as unknown", async () => {
  const staff = load();
  render(<TeamCertifications groupId="school" />);
  expect(await screen.findByText("school.certs.daysUnknown")).toBeInTheDocument();
  expect(staff.eq).toHaveBeenCalledWith("role", "instructor");
  expect(staff.eq).toHaveBeenCalledWith("flight_events.group_id", "school");
  expect(staff.eq).toHaveBeenCalledWith("flight_events.status", "confirmed");
  expect(staff.lte).toHaveBeenCalled();
});

it("shows a load error instead of an empty team", async () => {
  response(null, { message: "offline" }); response([]); response([]);
  render(<TeamCertifications groupId="school" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("school.certs.loadFailed");
  expect(screen.queryByText("school.certs.noTeam")).not.toBeInTheDocument();
});

it("rejects an expiry date before issue without writing", async () => {
  load();
  render(<TeamCertifications groupId="school" />);
  fireEvent.click(await screen.findByRole("button", { name: "school.certs.edit" }));
  fill("instructor", "2026-01-01", "2025-01-01");
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "school.certs.invalidDates" }));
  expect(from).toHaveBeenCalledTimes(4);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("retains failed edits and retries only changes not already saved", async () => {
  load();
  const cert = { id: "cert", user_id: "teacher", cert_type: "instructor", issued_at: "2025-01-01", valid_until: "2028-01-01" };
  response(cert);
  response(null, { message: "permission denied" });
  render(<TeamCertifications groupId="school" />);
  fireEvent.click(await screen.findByRole("button", { name: "school.certs.edit" }));
  fill("instructor"); fill("first_aid");
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "school.certs.saveFailed" })));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("school.certs.types.first_aid: school.certs.issuedAt")).toHaveValue("2025-01-01");
  const retry = response({ ...cert, id: "aid", cert_type: "first_aid" });
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(retry.upsert).toHaveBeenCalledWith(expect.objectContaining({ cert_type: "first_aid", group_id: "school" }), expect.anything());
  expect(from).toHaveBeenCalledTimes(7);
});
