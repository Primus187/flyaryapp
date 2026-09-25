import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SchoolProofPanel from "./SchoolProofPanel";

const { rpc, getSession, downloadBlob } = vi.hoisted(() => ({
  rpc: vi.fn(), getSession: vi.fn(), downloadBlob: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, auth: { getSession } } }));
vi.mock("@/lib/csv-export", () => ({ downloadBlob }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o?.count ? `${key} ${o.count}` : key) }) }));

const proof = {
  school: "Vertical", student: { name: "Anna", shvNumber: null }, from: "2026-09-25", to: "2026-09-25",
  total: 2, practice: 0, altitude: 2, sites: 1, days: 1, selfLogged: 4,
  flights: [
    { date: "2026-09-25", event: "Höhenflüge", category: "height_flight", takeoff: "Niederbauen", landing: "Emmetten", instructor: "Iris" },
    { date: "2026-09-25", event: "Höhenflüge", category: "height_flight", takeoff: "Niederbauen", landing: "Emmetten", instructor: "Iris" },
  ],
};
const renderPanel = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <SchoolProofPanel groupId="school" studentId="anna" /></QueryClientProvider>);

beforeEach(() => {
  rpc.mockReset(); downloadBlob.mockReset(); toast.mockReset();
  rpc.mockResolvedValue({ data: proof, error: null });
  getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the totals the SHV asks for and the flying days", async () => {
  renderPanel();
  expect(await screen.findByText("dossier.proof.flights 2")).toBeInTheDocument();
  expect(screen.getByText("dossier.proof.sites").nextSibling).toHaveTextContent("1");
  expect(screen.getByText("25.09.2026 · Höhenflüge")).toBeInTheDocument();
  expect(rpc).toHaveBeenCalledWith("school_student_proof", { _group_id: "school", _student_id: "anna", _from: null, _to: null });
});

it("exports the CSV and asks the Edge Function for the PDF", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["pdf"])) });
  vi.stubGlobal("fetch", fetchMock);
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "CSV" }));
  expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "ausbildungsnachweis_Anna.csv");
  fireEvent.click(screen.getByRole("button", { name: "dossier.proof.pdf" }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "ausbildungsnachweis_Anna.pdf"));
  expect(String(fetchMock.mock.calls[0][0])).toContain("/functions/v1/export-flightbook-pdf?mode=school_proof&group_id=school&student_id=anna");
});

it("reports a failed PDF", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "dossier.proof.pdf" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: "dossier.proof.pdfFailed", variant: "destructive" }));
});
