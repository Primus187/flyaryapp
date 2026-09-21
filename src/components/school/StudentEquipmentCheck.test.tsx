import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentEquipmentCheck from "./StudentEquipmentCheck";
import StudentEquipmentHint from "./StudentEquipmentHint";

const { from, toast } = vi.hoisted(() => ({ from: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function response(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), upsert: vi.fn(), single: vi.fn(), then: result.then.bind(result) };
  for (const method of [query.select, query.eq, query.in, query.upsert, query.single]) method.mockReturnValue(query);
  from.mockReturnValueOnce(query);
  return query;
}

beforeEach(() => { from.mockReset(); toast.mockReset(); });
afterEach(cleanup);

function loadStudent() {
  response([{ user_id: "student", role: "member" }]);
  response([{ user_id: "student", pilot_name: "Alex" }]);
  response([]);
}

describe("student equipment checks", () => {
  it("keeps the previous state after a rejected write and permits retry", async () => {
    loadStudent();
    const write = response(null, { message: "permission denied" });
    render(<StudentEquipmentCheck groupId="school" studentUserId="student" />);
    const helmet = await screen.findByRole("button", { name: "school.gear.items.helmet" });
    fireEvent.click(helmet);
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(helmet).toHaveAttribute("aria-pressed", "false");
    expect(helmet).not.toBeDisabled();
    expect(write.upsert).toHaveBeenCalledWith(expect.objectContaining({ group_id: "school", student_user_id: "student", checked_by: "teacher", present: true }), expect.anything());
    response({ id: "saved" });
    fireEvent.click(helmet);
    await waitFor(() => expect(helmet).toHaveAttribute("aria-pressed", "true"));
  });

  it("shows load failures rather than an empty or editable checklist", async () => {
    response(null, { message: "offline" });
    render(<StudentEquipmentCheck groupId="school" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("school.gear.loadFailed");
    expect(screen.queryByRole("button", { name: "school.gear.items.helmet" })).not.toBeInTheDocument();
    loadStudent();
    fireEvent.click(screen.getByRole("button", { name: "school.gear.retry" }));
    expect(await screen.findByText("Alex")).toBeInTheDocument();
  });
});

describe("altitude flight equipment hint", () => {
  it("warns when checks have not been recorded", async () => {
    const query = response([]);
    render(<StudentEquipmentHint groupId="school" studentUserId="student" />);
    expect(await screen.findByText("school.gear.signupWarning")).toBeInTheDocument();
    expect(query.eq).toHaveBeenCalledWith("group_id", "school");
    expect(query.eq).toHaveBeenCalledWith("student_user_id", "student");
  });

  it("does not warn for a complete checklist", async () => {
    response(["helmet", "shoes", "harness_protector", "reserve"].map((item) => ({ item, present: true })));
    render(<StudentEquipmentHint groupId="school" studentUserId="student" />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("reports an unknown status when loading fails", async () => {
    response(null, { message: "offline" });
    render(<StudentEquipmentHint groupId="school" studentUserId="student" />);
    expect(await screen.findByText("school.gear.loadFailed")).toBeInTheDocument();
    expect(screen.queryByText("school.gear.signupWarning")).not.toBeInTheDocument();
  });
});
