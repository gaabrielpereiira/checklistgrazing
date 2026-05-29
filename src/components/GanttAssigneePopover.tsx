import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { autoPositionTask } from "@/lib/autoPosition";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  name: string;
}

interface GanttAssigneePopoverProps {
  taskId: string;
  taskTitle: string;
  currentAssigneeId: string | null;
  currentHour: number;
  totalHours: number;
  profiles: Profile[];
  workStartHour: number;
  dailyWorkHours: number;
  weekendDays: number[];
  holidays: string[];
  children: React.ReactNode;
}

export function GanttAssigneePopover({
  taskId,
  taskTitle,
  currentAssigneeId,
  currentHour,
  totalHours,
  profiles,
  workStartHour,
  dailyWorkHours,
  weekendDays,
  holidays,
  children,
}: GanttAssigneePopoverProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState<string | null>(null);
  const [autoSlot, setAutoSlot] = useState<{ startDate: Date; startHour: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const newAssignee = profiles.find(p => p.user_id === newAssigneeId);

  const handleSelectAssignee = async (userId: string) => {
    if (userId === currentAssigneeId) {
      setPopoverOpen(false);
      return;
    }
    setNewAssigneeId(userId);
    setPopoverOpen(false);

    const result = await autoPositionTask({
      taskId,
      totalHours,
      assigneeId: userId,
      dailyWorkHours,
      workStartHour,
      weekendDays,
      holidays,
    });
    setAutoSlot({ startDate: result.startDate, startHour: result.startHour });
    setModalOpen(true);
  };

  const formatHour = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  const formatDate = (d: Date) => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const save = async (adapt: boolean) => {
    if (!newAssigneeId) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = { assignee_id: newAssigneeId };
      if (adapt && autoSlot) {
        updates.position_hour = autoSlot.startHour;
        updates.due_date = autoSlot.startDate.toISOString().split("T")[0];
      }
      const { data, error } = await supabase.from("tasks").update(updates as any).eq("id", taskId).select("linked_task_id").single();
      if (error) throw error;
      if (data?.linked_task_id) {
        await supabase.from("tasks").update(updates as any).eq("id", data.linked_task_id);
      }
      await supabase.from("tasks").update(updates as any).eq("linked_task_id", taskId);
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Responsável alterado para ${newAssignee?.name}`);
    } catch {
      toast.error("Erro ao atualizar responsável");
    } finally {
      setSaving(false);
      setModalOpen(false);
      setNewAssigneeId(null);
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Responsável</p>
          <div className="space-y-0.5 max-h-48 overflow-auto">
            {profiles.map(p => (
              <button
                key={p.user_id}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors text-left"
                onClick={() => handleSelectAssignee(p.user_id)}
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">
                  {p.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{p.name}</span>
                {p.user_id === currentAssigneeId && <span className="ml-auto text-[9px] text-muted-foreground">atual</span>}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); setNewAssigneeId(null); } }}>
        <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base">Atribuir a {newAssignee?.name}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              "{taskTitle}" — como posicionar na agenda?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="w-full flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Manter agenda atual</p>
                <p className="text-xs text-muted-foreground">Horário e datas não mudam</p>
              </div>
            </button>

            <button
              onClick={() => save(true)}
              disabled={saving}
              className="w-full flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Adaptar automaticamente</p>
                {autoSlot && (
                  <p className="text-xs text-muted-foreground">
                    Mover para {formatDate(autoSlot.startDate)} {formatHour(autoSlot.startHour)}
                  </p>
                )}
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
