import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap } from "lucide-react";
import { useWorkspaceSettings, useWorkspaceHolidays } from "@/hooks/useWorkspaceSettings";
import { formatHoursDuration } from "@/lib/taskDistribution";
import type { TaskPriority, ProfileWithSector, Project } from "@/hooks/useTaskData";

export interface NewTaskData {
  title: string;
  description: string | null;
  assignee_id: string | null;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string | null;
  duration_hours: number | null;
  auto_position: boolean;
  daily_work_hours?: number;
  work_start_hour?: number;
  weekend_days?: number[];
  holidays?: string[];
}

interface NewTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: NewTaskData) => void;
  profiles: ProfileWithSector[];
  projects?: Project[];
  loading?: boolean;
  columnName?: string;
}

export function NewTaskModal({ open, onOpenChange, onConfirm, profiles, projects, loading, columnName }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [durationHours, setDurationHours] = useState<number>(1);
  const [autoPosition, setAutoPosition] = useState(false);
  const { data: wsSettings } = useWorkspaceSettings();
  const { data: wsHolidays } = useWorkspaceHolidays();

  const dailyHours = wsSettings?.daily_work_hours || 8;
  const hasProject = projectId !== "none";
  const hasAssignee = assigneeId !== "none";

  const workStartHour = (() => {
    const t = wsSettings?.work_start_time || "09:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  })();

  const handleConfirm = () => {
    if (!title.trim()) return;

    const useAutoPos = autoPosition && hasAssignee;

    onConfirm({
      title: title.trim(),
      description: description.trim() || null,
      assignee_id: hasAssignee ? assigneeId : null,
      priority,
      due_date: useAutoPos ? null : (dueDate || null),
      project_id: hasProject ? projectId : null,
      duration_hours: durationHours,
      auto_position: useAutoPos,
      ...(useAutoPos ? {
        daily_work_hours: dailyHours,
        work_start_hour: workStartHour,
        weekend_days: wsSettings?.weekend_days || [0, 6],
        holidays: wsHolidays?.map(h => h.holiday_date) || [],
      } : {}),
    });

    // Reset
    setTitle("");
    setDescription("");
    setAssigneeId("none");
    setPriority("media");
    setDueDate("");
    setProjectId("none");
    setDurationHours(1);
    setAutoPosition(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Nova Task{columnName ? ` — ${columnName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titulo *</Label>
            <Input
              id="task-title"
              placeholder="Titulo da task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && title.trim() && handleConfirm()}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descricao</Label>
            <Textarea
              id="task-desc"
              placeholder="Descreva a task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Responsavel</Label>
              <Select value={assigneeId} onValueChange={(v) => { setAssigneeId(v); if (v === "none") setAutoPosition(false); }}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto-position toggle */}
          {hasAssignee && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <Checkbox
                id="auto-position"
                checked={autoPosition}
                onCheckedChange={(checked) => setAutoPosition(!!checked)}
              />
              <label htmlFor="auto-position" className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Posicionar automaticamente na agenda
              </label>
            </div>
          )}

          {/* Project selector */}
          {projects && projects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Duration */}
          <div className="space-y-1.5">
            <Label>Duracao (horas)</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                onClick={() => setDurationHours(Math.max(0.5, durationHours - 0.5))}
              >-</Button>
              <Input
                type="number" min={0.5} step={0.5}
                value={durationHours}
                onChange={(e) => { const v = parseFloat(e.target.value); if (v >= 0.5) setDurationHours(v); }}
                className="text-center h-9"
              />
              <Button
                type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                onClick={() => setDurationHours(durationHours + 0.5)}
              >+</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatHoursDuration(durationHours, dailyHours)}
            </p>
          </div>

          {/* Prazo final — hidden when auto-position is on */}
          {!autoPosition && (
            <div className="space-y-1.5">
              <Label>Prazo final</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Opcional — exibe linha de prazo no Gantt</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!title.trim() || loading}>
            Criar Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
