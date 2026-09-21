import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StudentEquipmentCheck from "@/components/school/StudentEquipmentCheck";
import type { StudentStatus } from "@/lib/student-status";

interface StudentInfo {
  userId: string;
  pilotName: string;
  trainingLevel: string | null;
  flightCount: number;
  examProgress: number; // 0-100
  lastSummary: string | null;
  status?: StudentStatus;
  statusReason?: string | null;
  statusUpdatedAt?: string | null;
}

interface Props {
  groupId?: string;
  students: StudentInfo[];
  onStatusChange?: (userId: string, status: StudentStatus, reason: string | null) => void | Promise<void>;
}

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function SchoolStudents({ groupId, students, onStatusChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [equipmentStudent, setEquipmentStudent] = useState<StudentInfo | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [statusChange, setStatusChange] = useState<{ student: StudentInfo; nextStatus: StudentStatus } | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const statusClasses: Record<StudentStatus, string> = {
    active: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
    cancelled: "bg-rose-500/10 text-rose-700 border border-rose-500/20",
  };

  const openStatusChange = (student: StudentInfo, nextStatus: StudentStatus) => {
    if (!groupId || !onStatusChange) return;
    setReasonDraft("");
    setStatusChange({ student, nextStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusChange || !onStatusChange) return;
    setSaving(true);
    await onStatusChange(statusChange.student.userId, statusChange.nextStatus, reasonDraft.trim() || null);
    setSaving(false);
    setStatusChange(null);
  };

  const visibleStudents = statusFilter === "active" ? students.filter((s) => (s.status ?? "active") === "active") : students;

  const handleExport = () => {
    if (students.length === 0) return;
    const headers = [
      t("school.csv.name"),
      t("school.csv.level"),
      t("school.csv.flights"),
      t("school.csv.examProgress"),
      t("school.csv.lastSummary"),
    ];
    const rows = students.map((s) => [
      csvEscape(s.pilotName),
      csvEscape(s.trainingLevel),
      csvEscape(s.flightCount),
      csvEscape(`${s.examProgress}%`),
      csvEscape(s.lastSummary),
    ].join(","));
    const csv = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: t("school.csv.exported") });
  };

  if (students.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("school.noStudents")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "active" | "all")}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("school.equipment.filterActive")}</SelectItem>
            <SelectItem value="all">{t("school.equipment.filterAll")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {t("school.csv.export")}
        </Button>
      </div>
      {visibleStudents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">{t("school.studentStatus.noneInFilter")}</div>
      )}
      {visibleStudents.map((s) => {
        const status = s.status ?? "active";
        return (
          <Card
            key={s.userId}
            className="border-0 shadow-sm hover:bg-muted/30 active:scale-[0.99] transition-all"
          >
            <CardContent className="p-3 flex items-center gap-3">
              <button type="button" onClick={() => navigate(`/pilot/${s.userId}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(s.pilotName || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{s.pilotName || t("common.unknown")}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {s.trainingLevel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {s.trainingLevel}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusClasses[status]}`}>
                      {t(`school.studentStatus.${status}`)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{s.flightCount} {t("school.flights")}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={s.examProgress} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{s.examProgress}%</span>
                  </div>
                  {s.lastSummary && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 italic">
                      "{s.lastSummary}"
                    </p>
                  )}
                  {status !== "active" && (s.statusReason || s.statusUpdatedAt) && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {s.statusUpdatedAt ? new Date(s.statusUpdatedAt).toLocaleDateString("de-CH") : ""}
                      {s.statusReason ? ` · ${s.statusReason}` : ""}
                    </p>
                  )}
                </div>
              </button>

              <Select
                value={status}
                onValueChange={(value) => openStatusChange(s, value as StudentStatus)}
                disabled={!groupId || !onStatusChange}
              >
                <SelectTrigger className="h-7 w-28 rounded-full text-[10px] border-0 bg-muted/60 px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("school.studentStatus.active")}</SelectItem>
                  <SelectItem value="paused">{t("school.studentStatus.paused")}</SelectItem>
                  <SelectItem value="cancelled">{t("school.studentStatus.cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
            {groupId && (
              <div className="px-3 pb-3">
                <Button size="sm" variant="outline" onClick={() => setEquipmentStudent(s)}>{t("school.gear.tab")}</Button>
              </div>
            )}
          </Card>
        );
      })}
      <Dialog open={!!equipmentStudent} onOpenChange={(open) => { if (!open) setEquipmentStudent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("school.gear.tab")} · {equipmentStudent?.pilotName}</DialogTitle></DialogHeader>
          {groupId && equipmentStudent && <StudentEquipmentCheck key={`${groupId}:${equipmentStudent.userId}`} groupId={groupId} studentUserId={equipmentStudent.userId} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!statusChange} onOpenChange={(open) => { if (!open && !saving) setStatusChange(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusChange?.student.pilotName} · {statusChange ? t(`school.studentStatus.${statusChange.nextStatus}`) : ""}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            placeholder={t("school.studentStatus.reasonPlaceholder")}
            rows={3}
            disabled={saving}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChange(null)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={confirmStatusChange} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
