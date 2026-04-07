import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (goal: { title: string; goal_type: string; target_value: number; unit: string }) => void;
}

const TEMPLATES = [
  { type: "flights", title: "Anzahl Flüge", unit: "", defaultTarget: 50 },
  { type: "hours", title: "Flugstunden", unit: "h", defaultTarget: 100 },
  { type: "altitude", title: "Höhenmeter", unit: "m", defaultTarget: 50000 },
  { type: "distance", title: "Streckenkilometer", unit: "km", defaultTarget: 200 },
];

export default function GoalFormDialog({ open, onOpenChange, onSubmit }: GoalFormDialogProps) {
  const { t } = useTranslation();
  const [goalType, setGoalType] = useState("flights");
  const [title, setTitle] = useState(TEMPLATES[0].title);
  const [targetValue, setTargetValue] = useState(TEMPLATES[0].defaultTarget);
  const [unit, setUnit] = useState(TEMPLATES[0].unit);

  const handleTypeChange = (type: string) => {
    setGoalType(type);
    const tmpl = TEMPLATES.find((t) => t.type === type);
    if (tmpl) {
      setTitle(tmpl.title);
      setTargetValue(tmpl.defaultTarget);
      setUnit(tmpl.unit);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || targetValue <= 0) return;
    onSubmit({ title: title.trim(), goal_type: goalType, target_value: targetValue, unit });
    onOpenChange(false);
    // Reset
    setGoalType("flights");
    setTitle(TEMPLATES[0].title);
    setTargetValue(TEMPLATES[0].defaultTarget);
    setUnit(TEMPLATES[0].unit);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.addGoal")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("goals.goalType")}</Label>
            <Select value={goalType} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.type} value={t.type}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("goals.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("goals.targetValue")}</Label>
            <Input type="number" min={1} value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} className="w-full">{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
