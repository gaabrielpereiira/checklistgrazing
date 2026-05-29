import { useState, useEffect, useMemo } from "react";
import { X, Calendar, Plus, Trash2, AlertTriangle, Link2, ArrowRight, ArrowLeft, ExternalLink, Clock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PriorityBadge } from "./PriorityBadge";
import { AssigneeScheduleModal } from "./AssigneeScheduleModal";
import { useUpdateTask, useDeleteTask, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useProjects, useAllTasks, useTaskKanbanHistory, useCollections, type FullTask, type Column, type TaskPriority, type ProfileWithSector } from "@/hooks/useTaskData";
import { useWorkspaceSettings, useWorkspaceHolidays } from "@/hooks/useWorkspaceSettings";
import { formatHoursDuration } from "@/lib/taskDistribution";
import { autoPositionTask } from "@/lib/autoPosition";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface TaskDetailPanelProps {
  task: FullTask | null;
  columns: Column[];
  profiles: ProfileWithSector[];
  onClose: () => void;
  expandImpediments?: boolean;
}

interface LinkedInfo {
  id: string;
  title: string;
  collection_name: string;
  column_name: string;
  direction: "outgoing" | "incoming";
}

export function TaskDetailPanel({ task, columns, profiles = [], onClose, expandImpediments = false }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const { data: projects } = useProjects();
  const { data: wsSettings } = useWorkspaceSettings();
  const { data: holidays } = useWorkspaceHolidays();
  const { data: allTasks } = useAllTasks();
  const { data: kanbanHistory } = useTaskKanbanHistory();
  const { data: collections } = useCollections();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkedInfo, setLinkedInfo] = useState<LinkedInfo | null>(null);
  const [assigneeModal, setAssigneeModal] = useState<{ open: boolean; newAssigneeId: string }>({ open: false, newAssigneeId: "" });

  const dailyHours = wsSettings?.daily_work_hours || 8;
  const holidayDates = holidays?.map(h => h.holiday_date) || [];
  const weekendDays = wsSettings?.weekend_days || [0, 6];
  const workStartHour = (() => {
    const t = wsSettings?.work_start_time || "09:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  })();

  // Fetch linked task info
  useEffect(() => {
    if (!task) { setLinkedInfo(null); return; }
    const fetchLinked = async () => {
      if (task.linked_task_id) {
        const { data } = await supabase
          .from("tasks")
          .select("id, title, collection_id, column_id")
          .eq("id", task.linked_task_id)
          .single();
        if (data) {
          const { data: col } = await supabase.from("columns").select("name").eq("id", data.column_id).single();
          const { data: coll } = await supabase.from("collections").select("name").eq("id", data.collection_id).single();
          setLinkedInfo({
            id: data.id,
            title: data.title,
            collection_name: coll?.name || "?",
            column_name: col?.name || "?",
            direction: "outgoing",
          });
          return;
        }
      }
      // Check if another task links TO this one
      const { data: incoming } = await supabase
        .from("tasks")
        .select("id, title, collection_id, column_id")
        .eq("linked_task_id", task.id)
        .limit(1)
        .single();
      if (incoming) {
        const { data: col } = await supabase.from("columns").select("name").eq("id", incoming.column_id).single();
        const { data: coll } = await supabase.from("collections").select("name").eq("id", incoming.collection_id).single();
        setLinkedInfo({
          id: incoming.id,
          title: incoming.title,
          collection_name: coll?.name || "?",
          column_name: col?.name || "?",
          direction: "incoming",
        });
      } else {
        setLinkedInfo(null);
      }
    };
    fetchLinked();
  }, [task?.id, task?.linked_task_id]);

  if (!task) return null;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());
  const activeImpediments = task.impediments?.filter(imp => !imp.resolved_at) || [];
  const resolvedImpediments = task.impediments?.filter(imp => imp.resolved_at) || [];

  const handleTitleSave = async () => {
    if (title.trim() && title !== task.title) {
      updateTask.mutate({ id: task.id, title: title.trim() });
      // Sync to linked task
      if (task.linked_task_id) {
        await supabase.from("tasks").update({ title: title.trim() }).eq("id", task.linked_task_id);
      }
      // Sync to tasks that link TO this one
      await supabase.from("tasks").update({ title: title.trim() }).eq("linked_task_id", task.id);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    }
    setEditingTitle(false);
  };

  const handleDescSave = async () => {
    const newDesc = description || null;
    if (description !== (task.description || "")) {
      updateTask.mutate({ id: task.id, description: newDesc });
      // Sync to linked task
      if (task.linked_task_id) {
        await supabase.from("tasks").update({ description: newDesc }).eq("id", task.linked_task_id);
      }
      // Sync to tasks that link TO this one
      await supabase.from("tasks").update({ description: newDesc }).eq("linked_task_id", task.id);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    createSubtask.mutate({ task_id: task.id, title: newSubtaskTitle.trim(), position: (task.subtasks?.length || 0) });
    setNewSubtaskTitle("");
  };

  const handleDelete = () => {
    deleteTask.mutate({ id: task.id, collection_id: task.collection_id });
    onClose();
    toast.success("Task excluída");
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l bg-card shadow-2xl animate-slide-in-right">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-card-foreground">Detalhes da Task</h2>
              {linkedInfo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full cursor-help">
                        <Link2 className="h-3 w-3" />
                        {linkedInfo.direction === "outgoing" ? (
                          <><ArrowRight className="h-2.5 w-2.5" /> {linkedInfo.collection_name}</>
                        ) : (
                          <><ArrowLeft className="h-2.5 w-2.5" /> de: {linkedInfo.collection_name}</>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        {linkedInfo.direction === "outgoing"
                          ? `Vinculado a: ${linkedInfo.collection_name} → ${linkedInfo.column_name}`
                          : `Originado de: ${linkedInfo.collection_name} → ${linkedInfo.column_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Título e descrição são sincronizados. Prioridade e responsável são independentes.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            <div className="space-y-6">
              {/* Title */}
              {editingTitle ? (
                <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === "Enter" && handleTitleSave()} autoFocus className="font-heading text-xl font-bold" />
              ) : (
                <h3 className="font-heading text-xl font-bold text-card-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => { setTitle(task.title); setEditingTitle(true); }}>
                  {task.title}
                </h3>
              )}

              {/* Linked card info banner */}
              {linkedInfo && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary">
                      {linkedInfo.direction === "outgoing" ? "Vinculado a" : "Originado de"}: {linkedInfo.collection_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Coluna: {linkedInfo.column_name}
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Descrição {linkedInfo && <span className="text-primary">(sincronizada)</span>}
                </label>
                <Textarea placeholder="Adicionar descrição..." defaultValue={task.description || ""} onChange={(e) => setDescription(e.target.value)} onBlur={handleDescSave} className="mt-1 min-h-[80px]" />
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={task.column_id} onValueChange={(val) => updateTask.mutate({ id: task.id, column_id: val })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{columns.map(col => <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                  <Select value={task.priority} onValueChange={(val) => updateTask.mutate({ id: task.id, priority: val as TaskPriority })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                  <Select
                    value={task.assignee_id || "none"}
                    onValueChange={(val) => {
                      const newId = val === "none" ? null : val;
                      if (newId && newId !== task.assignee_id) {
                        setAssigneeModal({ open: true, newAssigneeId: newId });
                      } else {
                        updateTask.mutate({ id: task.id, assignee_id: newId }, {
                          onSuccess: () => {
                            if (newId) {
                              supabase.functions.invoke("notify-task-assigned", {
                                body: { task_id: task.id, assigner_id: user?.id },
                              }).catch(console.warn);
                            }
                          },
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                  <Input type="date" value={task.due_date || ""} onChange={(e) => updateTask.mutate({ id: task.id, due_date: e.target.value || null })} className={cn("mt-1", isOverdue && "text-status-overdue")} />
                </div>
              </div>

              {/* Project & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Projeto</label>
                  <Select value={(task as any).project_id || "none"} onValueChange={(val) => updateTask.mutate({ id: task.id, project_id: val === "none" ? null : val } as any)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(task as any).project_id && (() => {
                    const proj = projects?.find(p => p.id === (task as any).project_id);
                    return proj ? (
                      <Button
                        variant="link" size="sm" className="h-auto p-0 mt-1 text-xs text-primary gap-1"
                        onClick={() => navigate(`/projetos/${proj.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" /> Ver projeto
                      </Button>
                    ) : null;
                  })()}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Duracao (horas)
                  </label>
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      variant="outline" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => {
                        const current = (task as any).duration_hours || 1;
                        if (current > 0.5) updateTask.mutate({ id: task.id, duration_hours: current - 0.5 } as any);
                      }}
                    >-</Button>
                    <Input
                      type="number" min={0.5} step={0.5}
                      value={(task as any).duration_hours || 1}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (v >= 0.5) updateTask.mutate({ id: task.id, duration_hours: v } as any);
                      }}
                      className="text-center h-9"
                    />
                    <Button
                      variant="outline" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => {
                        const current = (task as any).duration_hours || 1;
                        updateTask.mutate({ id: task.id, duration_hours: current + 0.5 } as any);
                      }}
                    >+</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatHoursDuration((task as any).duration_hours || 1, dailyHours)}
                  </p>
                </div>
              </div>

              {/* Derived dates for project tasks */}
              {(() => {
                const proj = projects?.find(p => p.id === (task as any).project_id);
                const posDay = (task as any).position_day;
                const dur = (task as any).duration_days || 1;
                if (!proj || posDay == null) return null;
                const startDate = new Date(proj.start_date);
                const taskStart = new Date(startDate);
                taskStart.setDate(taskStart.getDate() + posDay - 1);
                const taskEnd = new Date(taskStart);
                taskEnd.setDate(taskEnd.getDate() + dur - 1);
                const projectEnd = new Date(proj.end_date);
                const isLate = taskEnd > projectEnd;
                return (
                  <div className={cn(
                    "rounded-lg border px-3 py-2 text-xs space-y-1",
                    isLate ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Início no projeto:</span>
                      <span className="font-medium">Dia {posDay} — {taskStart.toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Fim no projeto:</span>
                      <span className="font-medium">{taskEnd.toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={cn("font-medium", isLate ? "text-destructive" : "text-emerald-600")}>
                        {isLate ? "Fora do prazo do projeto" : "Dentro do prazo"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Subtasks */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Subtasks ({task.subtasks?.filter(s => s.is_done).length || 0}/{task.subtasks?.length || 0})
                </label>
                <div className="mt-2 space-y-1.5">
                  {task.subtasks?.sort((a, b) => a.position - b.position).map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 rounded-md border p-2">
                      <Checkbox checked={sub.is_done} onCheckedChange={(checked) => updateSubtask.mutate({ id: sub.id, is_done: !!checked })} />
                      <span className={cn("flex-1 text-sm", sub.is_done && "line-through text-muted-foreground")}>{sub.title}</span>
                      <Input
                        type="date"
                        value={(sub as any).due_date || ""}
                        onChange={(e) => updateSubtask.mutate({ id: sub.id, due_date: e.target.value || null } as any)}
                        className="h-6 w-28 text-[11px] px-1"
                        title="Prazo da subtask"
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubtask.mutate(sub.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input placeholder="Nova subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()} className="h-8 text-sm" />
                    <Button size="sm" variant="outline" onClick={handleAddSubtask} className="h-8 px-2"><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>

              {/* Movement History */}
              {task && (() => {
                // Combine history from this task AND its linked counterpart
                const linkedIds = new Set<string>([task.id]);
                if (task.linked_task_id) linkedIds.add(task.linked_task_id);
                // Also check if another task links TO this one
                const incomingLinked = allTasks?.find(t => t.linked_task_id === task.id);
                if (incomingLinked) linkedIds.add(incomingLinked.id);
                const taskHistory = (kanbanHistory?.filter(h => linkedIds.has(h.task_id)) || [])
                  .sort((a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime());
                if (taskHistory.length === 0) return null;

                const calcWorkHrs = (from: Date, to: Date) => {
                  let hours = 0;
                  const d = new Date(from); d.setHours(0, 0, 0, 0);
                  const end = new Date(to); end.setHours(0, 0, 0, 0);
                  while (d <= end) {
                    const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const isOff = weekendDays.includes(d.getDay()) || holidayDates.includes(dk);
                    if (!isOff) hours += dailyHours;
                    d.setDate(d.getDate() + 1);
                  }
                  return hours;
                };

                return (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <History className="h-3.5 w-3.5" /> Histórico de movimentação
                    </label>
                    <div className="mt-2 space-y-1.5">
                      {taskHistory.map(rec => {
                        const coll = collections?.find(c => c.id === rec.collection_id);
                        const collColor = (coll as any)?.color || null;
                        const entered = new Date(rec.entered_at);
                        const exited = rec.exited_at ? new Date(rec.exited_at) : null;
                        const workHrs = calcWorkHrs(entered, exited || new Date());
                        const isExceeded = rec.time_limit_hours && rec.time_limit_hours > 0 && workHrs > rec.time_limit_hours;
                        const exceededHrs = isExceeded ? Math.round((workHrs - rec.time_limit_hours!) * 10) / 10 : 0;

                        return (
                          <div key={rec.id} className={cn(
                            "flex items-start gap-2 rounded-md border p-2 text-xs",
                            isExceeded && "border-destructive/40 bg-destructive/5"
                          )}>
                            {collColor && (
                              <span className="h-3 w-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: collColor }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-card-foreground">{coll?.name || "Coleção removida"}</div>
                              <div className="text-muted-foreground">
                                {entered.toLocaleDateString('pt-BR')} {entered.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                {exited ? ` → ${exited.toLocaleDateString('pt-BR')} ${exited.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-muted-foreground">
                                  {exited ? `${Math.round(workHrs * 10) / 10}h úteis` : 'Ainda aqui'}
                                </span>
                                {rec.time_limit_hours && rec.time_limit_hours > 0 && (
                                  <span className="text-muted-foreground">· Limite: {rec.time_limit_hours}h</span>
                                )}
                                {isExceeded && (
                                  <span className="font-bold text-destructive">+{exceededHrs}h excedido</span>
                                )}
                                {rec.time_limit_hours && rec.time_limit_hours > 0 && !isExceeded && (
                                  <span className="text-emerald-600 font-medium">No prazo</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(activeImpediments.length > 0 || resolvedImpediments.length > 0) && (
                <div ref={expandImpediments ? (el) => { el?.scrollIntoView({ behavior: "smooth", block: "start" }); } : undefined}
                     className={cn(expandImpediments && "ring-2 ring-status-attention/30 rounded-lg p-1 -m-1")}>
                  <label className="text-xs font-medium text-muted-foreground">Impedimentos</label>
                  <div className="mt-2 space-y-2">
                    {activeImpediments.map(imp => (
                      <div key={imp.id} className="flex items-start gap-2 rounded-md border border-status-attention/30 bg-status-attention/5 p-3">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-status-attention mt-0.5" />
                        <div>
                          <p className="text-sm text-card-foreground">{imp.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(imp.reported_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                    {resolvedImpediments.map(imp => (
                      <div key={imp.id} className="flex items-start gap-2 rounded-md border border-status-on-track/30 bg-status-on-track/5 p-3 opacity-60">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-status-on-track mt-0.5" />
                        <div>
                          <p className="text-sm text-card-foreground line-through">{imp.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Resolvido em {new Date(imp.resolved_at!).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t p-4">
            <Button variant="destructive" size="sm" className="w-full" onClick={handleDelete}>Excluir Task</Button>
          </div>
        </div>
      </div>

      {/* Assignee schedule modal */}
      <AssigneeScheduleModal
        open={assigneeModal.open}
        onOpenChange={(open) => setAssigneeModal(prev => ({ ...prev, open }))}
        assigneeName={profiles.find(p => p.user_id === assigneeModal.newAssigneeId)?.name || ""}
        onKeepCurrent={() => {
          updateTask.mutate({ id: task.id, assignee_id: assigneeModal.newAssigneeId }, {
            onSuccess: () => {
              supabase.functions.invoke("notify-task-assigned", {
                body: { task_id: task.id, assigner_id: user?.id },
              }).catch(console.warn);
            },
          });
        }}
        onAutoAdapt={async () => {
          const totalHours = (task as any).duration_hours || ((task as any).duration_days || 1) * dailyHours;

          const result = await autoPositionTask({
            taskId: task.id,
            totalHours,
            assigneeId: assigneeModal.newAssigneeId!,
            dailyWorkHours: dailyHours,
            workStartHour,
            weekendDays,
            holidays: holidayDates,
          });

          updateTask.mutate({
            id: task.id,
            assignee_id: assigneeModal.newAssigneeId,
            position_hour: result.startHour,
            due_date: result.dueDateStr,
          } as any, {
            onSuccess: () => {
              supabase.functions.invoke("notify-task-assigned", {
                body: { task_id: task.id, assigner_id: user?.id },
              }).catch(console.warn);
            },
          });
          toast.success("Task posicionada automaticamente na agenda!");
        }}
      />
    </>
  );
}
