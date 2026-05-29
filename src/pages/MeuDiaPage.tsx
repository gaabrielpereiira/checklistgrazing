import { useState, useMemo } from "react";
import { Sun, CheckCircle2, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityDot } from "@/components/PriorityBadge";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { useAllTasks, useUpdateTask, useUpdateSubtask } from "@/hooks/useTaskData";
import { cn } from "@/lib/utils";

export default function MeuDiaPage() {
  const { data: tasks } = useAllTasks();
  const updateTask = useUpdateTask();
  const updateSubtask = useUpdateSubtask();
  const today = new Date().toISOString().split("T")[0];
  const activeTasks = tasks?.filter(t => !(t as any).is_archived) || [];
  const todayTasks = activeTasks.filter(t => t.due_date === today);
  const overdueTasks = activeTasks.filter(t => t.due_date && t.due_date < today);

  // Subtasks with due_date = today across all tasks
  const todaySubtasks = useMemo(() => {
    if (!tasks) return [];
    const result: { subtask: any; task: typeof tasks[0] }[] = [];
    for (const task of activeTasks) {
      for (const sub of task.subtasks || []) {
        if ((sub as any).due_date === today && !sub.is_done) {
          result.push({ subtask: sub, task });
        }
      }
    }
    return result;
  }, [activeTasks, today]);

  const priorityCounts = useMemo(() => {
    const all = [...todayTasks, ...overdueTasks];
    return {
      urgente: all.filter(t => t.priority === "urgente").length,
      alta: all.filter(t => t.priority === "alta").length,
      media: all.filter(t => t.priority === "media").length,
      baixa: all.filter(t => t.priority === "baixa").length,
      total: all.length + todaySubtasks.length,
      overdue: overdueTasks.length,
    };
  }, [todayTasks, overdueTasks, todaySubtasks]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-attention/15">
            <Sun className="h-5 w-5 text-status-attention" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Meu Dia</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Summary Widget */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-card-foreground">{priorityCounts.total}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Total</p>
          </div>
          <div className={cn("rounded-xl border p-4 text-center", priorityCounts.overdue > 0 ? "bg-status-overdue/10 border-status-overdue/30" : "bg-card")}>
            <p className={cn("text-2xl font-bold", priorityCounts.overdue > 0 ? "text-status-overdue" : "text-card-foreground")}>{priorityCounts.overdue}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Atrasadas</p>
          </div>
          <div className={cn("rounded-xl border p-4 text-center", priorityCounts.urgente > 0 ? "bg-priority-urgent/10 border-priority-urgent/30" : "bg-card")}>
            <p className={cn("text-2xl font-bold", priorityCounts.urgente > 0 ? "text-priority-urgent" : "text-card-foreground")}>{priorityCounts.urgente}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Urgentes</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-priority-high">{priorityCounts.alta}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Alta</p>
          </div>
        </div>

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="mb-6">
            <h2 className="font-heading text-sm font-semibold text-status-overdue mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Atrasadas ({overdueTasks.length})
            </h2>
            <div className="space-y-2">
              {overdueTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-status-overdue/20 bg-status-overdue/5 p-4 transition-colors hover:bg-status-overdue/10">
                  <Checkbox />
                  <PriorityDot priority={task.priority} />
                  <span className="flex-1 text-sm font-medium text-card-foreground">{task.title}</span>
                  <span className="text-[11px] text-status-overdue font-medium">
                    {new Date(task.due_date!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                  {task.collections && <Badge variant="secondary" className="text-[10px]">{task.collections.name}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Tasks */}
        <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-2">Hoje ({todayTasks.length})</h2>
        {todayTasks.length === 0 && overdueTasks.length === 0 && todaySubtasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="h-16 w-16 text-status-on-track/30 mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground">Nenhuma task pra hoje</h2>
            <p className="mt-1 text-sm text-muted-foreground">Aproveite! 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-kanban-card-hover">
                <Checkbox />
                <PriorityDot priority={task.priority} />
                <span className="flex-1 text-sm font-medium text-card-foreground">{task.title}</span>
                {task.collections && <Badge variant="secondary" className="text-[10px]">{task.collections.name}</Badge>}
              </div>
            ))}
          </div>
        )}

        {/* Today's Subtasks */}
        {todaySubtasks.length > 0 && (
          <div className="mt-6">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-2">
              Subtasks de hoje ({todaySubtasks.length})
            </h2>
            <div className="space-y-2">
              {todaySubtasks.map(({ subtask, task }) => (
                <div key={subtask.id} className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-kanban-card-hover">
                  <Checkbox
                    checked={subtask.is_done}
                    onCheckedChange={(checked) => updateSubtask.mutate({ id: subtask.id, is_done: !!checked })}
                  />
                  <span className={cn("flex-1 text-sm font-medium text-card-foreground", subtask.is_done && "line-through text-muted-foreground")}>
                    {subtask.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {task.title}
                  </Badge>
                  {task.collections && <Badge variant="secondary" className="text-[10px]">{task.collections.name}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
