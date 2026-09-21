import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import SchoolStudents from "./SchoolStudents";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(cleanup);

const baseStudent = {
  pilotName: "Alex",
  trainingLevel: "grundkurs",
  flightCount: 3,
  examProgress: 40,
  lastSummary: null,
};

function renderStudents(students: Parameters<typeof SchoolStudents>[0]["students"]) {
  return render(
    <MemoryRouter>
      <SchoolStudents groupId="school" students={students} />
    </MemoryRouter>,
  );
}

it("shows only active students by default and hides paused/cancelled ones", () => {
  renderStudents([
    { ...baseStudent, userId: "s1", pilotName: "Alex", status: "active" },
    { ...baseStudent, userId: "s2", pilotName: "Bina", status: "paused" },
    { ...baseStudent, userId: "s3", pilotName: "Chris", status: "cancelled" },
  ]);
  expect(screen.getByText("Alex")).toBeInTheDocument();
  expect(screen.queryByText("Bina")).not.toBeInTheDocument();
  expect(screen.queryByText("Chris")).not.toBeInTheDocument();
});

it("shows a filter-specific empty state when nobody matches the default active filter", () => {
  renderStudents([{ ...baseStudent, userId: "s1", status: "paused" }]);
  expect(screen.getByText("school.studentStatus.noneInFilter")).toBeInTheDocument();
  expect(screen.queryByText("Alex")).not.toBeInTheDocument();
});

it("does not leak a paused student's reason into the default active-only view", () => {
  renderStudents([
    { ...baseStudent, userId: "s1", status: "active" },
    { ...baseStudent, userId: "s2", pilotName: "Bina", status: "paused", statusReason: "Verletzung", statusUpdatedAt: "2026-06-01T00:00:00Z" },
  ]);
  expect(screen.queryByText(/Verletzung/)).not.toBeInTheDocument();
});

it("shows a flagged next-step handoff note prominently", () => {
  renderStudents([
    { ...baseStudent, userId: "s1", status: "active", nextStep: "Höhenflüge starten" },
  ]);
  expect(screen.getByText("Höhenflüge starten")).toBeInTheDocument();
});
