import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronRight, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StudentInfo {
  userId: string;
  pilotName: string;
  trainingLevel: string | null;
  flightCount: number;
  examProgress: number; // 0-100
  lastSummary: string | null;
}

interface Props {
  students: StudentInfo[];
}

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function SchoolStudents({ students }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

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
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {t("school.csv.export")}
        </Button>
      </div>
      {students.map((s) => (
        <Card
          key={s.userId}
          className="border-0 shadow-sm cursor-pointer hover:bg-muted/30 active:scale-[0.99] transition-all"
          onClick={() => navigate(`/pilot/${s.userId}`)}
        >
          <CardContent className="p-3 flex items-center gap-3">
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
              <div className="flex items-center gap-2 mt-0.5">
                {s.trainingLevel && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {s.trainingLevel}
                  </span>
                )}
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
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
