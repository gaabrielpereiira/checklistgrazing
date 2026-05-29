import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Timer, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssigneeConfig, ProfileWithSector } from "@/hooks/useTaskData";

interface TimeLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  destinationName: string;
  destinationColor: string | null;
  timeOptions: number[];
  assigneeConfig?: AssigneeConfig;
  profiles?: ProfileWithSector[];
  onConfirm: (durationHours: number | null, assigneeId: string | null) => void;
}

export function TimeLimitModal({
  open,
  onOpenChange,
  taskTitle,
  destinationName,
  destinationColor,
  timeOptions,
  assigneeConfig,
  profiles,
  onConfirm,
}: TimeLimitModalProps) {
  const [customHours, setCustomHours] = useState("");
  const [selected, setSelected] = useState<"custom" | number | null>(null);
  const [chosenAssignee, setChosenAssignee] = useState<string>("");

  const needsAssigneeChoice = assigneeConfig?.mode === "choose" && (assigneeConfig.candidates?.length ?? 0) > 0;
  const candidates = needsAssigneeChoice
    ? (profiles || []).filter(p => assigneeConfig.candidates.includes(p.user_id))
    : [];

  const handleConfirm = () => {
    let hours: number | null = null;
    if (selected === "custom") {
      const val = parseFloat(customHours);
      if (isNaN(val) || val < 0.5) return;
      hours = val;
    } else if (selected !== null) {
      hours = selected;
    }

    const assignee = needsAssigneeChoice ? (chosenAssignee || null) : null;
    onConfirm(hours, assignee);
    onOpenChange(false);
  };

  const isCustomValid = (() => {
    if (selected !== "custom") return true;
    const val = parseFloat(customHours);
    return !isNaN(val) && val >= 0.5;
  })();

  const canConfirm = (selected === null || (selected === "custom" ? isCustomValid : true))
    && (!needsAssigneeChoice || chosenAssignee);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Configurar card no kanban destino
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Task: <span className="font-medium text-foreground">{taskTitle}</span>
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Destino:
              {destinationColor && (
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: destinationColor }} />
              )}
              <span className="font-medium text-foreground">{destinationName}</span>
            </p>
          </div>

          {/* Time selection */}
          {timeOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Quanto tempo a task terá neste kanban?</Label>
              <div className="flex flex-wrap gap-2">
                {timeOptions.map(hours => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setSelected(hours)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      selected === hours
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {hours}h
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setSelected("custom")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  selected === "custom"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                )}
              >
                <Clock className="h-4 w-4" />
                Tempo customizado
              </button>

              {selected === "custom" && (
                <div className="flex items-center gap-2 pl-6">
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                    placeholder="Ex: 3"
                    className="h-8 w-24 text-sm"
                    autoFocus
                  />
                  <span className="text-sm text-muted-foreground">horas</span>
                  {!isCustomValid && customHours && (
                    <span className="text-xs text-destructive">Mín: 0.5h</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assignee selection (only for "choose" mode) */}
          {needsAssigneeChoice && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Responsável do novo card
              </Label>
              <Select value={chosenAssignee} onValueChange={setChosenAssignee}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  {candidates.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Confirmar e mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
