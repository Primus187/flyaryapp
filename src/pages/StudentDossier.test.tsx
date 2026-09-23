import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StudentDossier from "./StudentDossier";
import { fetchDossier } from "@/lib/student-dossier";
import type { Overview } from "@/lib/student-dossier";

const mocks = vi.hoisted(() => ({ groups: [{ id: "school", name: "My school", canManage: true }], setMode: vi.fn(), setSchoolGroupId: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));
vi.mock("@/contexts/RoleModeContext", () => ({ useRoleMode: () => mocks }));
vi.mock("@/hooks/use-school-access", () => ({ useSchoolGroups: () => ({ data: mocks.groups, isPending: false, isError: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/school/StudentEquipmentCheck", () => ({ default: () => <div>Gear check</div> }));
vi.mock("@/lib/student-dossier", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/student-dossier")>(), fetchDossier: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } }) }));

const overview: Overview = { name: "Alex", level: "altitude", shvNumber: "123", theoryDate: null, practicalDate: null, gliderInfo: null,
  flightCount: 31, lastFlight: "2026-09-01", examDone: 1, examTotal: 3, status: { status: "paused", reason: "Pause reason", date: "2026-09-01" },
  nextStep: { note: "Practise landing", eventId: "day", date: "2026-09-01" }, upcoming: [] };
beforeEach(() => { vi.mocked(fetchDossier).mockReset(); mocks.groups = [{ id: "school", name: "My school", canManage: true }]; });
afterEach(cleanup);
function show(path = "/school/students/school/student") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/school/students/:groupId/:studentId" element={<StudentDossier />} /></Routes></MemoryRouter></QueryClientProvider>);
}
it("opens the school dossier with status and next steps using the URL's school and student", async () => {
  vi.mocked(fetchDossier).mockResolvedValue(overview);
  show();
  expect(await screen.findByRole("heading", { name: "Alex" })).toBeInTheDocument();
  expect(screen.getByText("Practise landing")).toBeInTheDocument();
  expect(screen.getByText("Pause reason")).toBeInTheDocument();
  expect(fetchDossier).toHaveBeenCalledWith("school", "student", "overview", 0, expect.any(AbortSignal));
});
it("does not request dossier data for helpers or an inaccessible school", async () => {
  mocks.groups[0].canManage = false;
  show();
  expect(screen.getByRole("alert")).toHaveTextContent("dossier.noAccess");
  expect(fetchDossier).not.toHaveBeenCalled();
});
it("offers retry instead of displaying a missing student as an empty dossier", async () => {
  vi.mocked(fetchDossier).mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(overview);
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("dossier.loadFailed");
  fireEvent.click(screen.getByRole("button", { name: "performance.retry" }));
  expect(await screen.findByRole("heading", { name: "Alex" })).toBeInTheDocument();
});
it("loads only the selected section and paginates flights without losing notes", async () => {
  vi.mocked(fetchDossier).mockImplementation(async (_group, _student, section, offset) => {
    if (section === "overview") return overview;
    return { total: 31, rows: Array.from({ length: offset ? 1 : 30 }, (_, i) => ({ id: `flight-${(offset || 0) + i}`, date: "2026-09-01", glider: "Wing", duration_minutes: 15, altitude_gain: 500, comments: null, takeoff: `Start ${(offset || 0) + i}`, landing: null, notes: [{ id: "note", note: "Coach note", author: "Teacher", visible: false, date: "2026-09-01" }] })) };
  });
  show();
  await screen.findByRole("heading", { name: "Alex" });
  expect(fetchDossier).toHaveBeenCalledTimes(1);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "dossier.sections.flights" }), { button: 0, ctrlKey: false });
  await screen.findByText(/Start 0/);
  expect(screen.getAllByText("Coach note")).toHaveLength(30);
  fireEvent.click(screen.getByRole("button", { name: "dossier.loadMore" }));
  await screen.findByText(/Start 30/);
  await waitFor(() => expect(screen.queryByRole("button", { name: "dossier.loadMore" })).not.toBeInTheDocument());
  expect(fetchDossier).toHaveBeenLastCalledWith("school", "student", "flights", 30, expect.any(AbortSignal));
});
