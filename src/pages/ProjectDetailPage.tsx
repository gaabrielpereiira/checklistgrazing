import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import {
  useProjects, useAllTasks, useUpdateProject, useDeleteProject, useUpdateTask,
  useCollections, useColumns, useProfiles, useAllColumns,
  type FullTaskWithCollection, type FullTask,
} from "@/hooks/useTaskData";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings, useWorkspaceHolidays } from "@/hooks/useWorkspaceSettings";
import { formatHoursDuration } from "@/lib/taskDistribution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, GanttChart, Trash2, Plus, LinkIcon, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { data: projects } = useProjects();
  const { data: allTasks } = useAllTasks();
  const { data: collections } = useCollections();
  const { data: allColumns } = useAllColumns();
  const { data: profiles } = useProfiles();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const updateTask = useUpdateTask();
  const { data: wsSettings } = useWorkspaceSettings();
  const { data: wsHolidays } = useWorkspaceHolidays();
  const dailyHours = wsSettings?.daily_work_hours || 8;
  const workStartHour = (() => {
    const t = wsSettings?.work_start_time || "09:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  })();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [filterCol, setFilterCol] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPositioned, setFilterPositioned] = useState("all");

  // Modals
  const [showAssociate, setShowAssociate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColId, setNewColId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState("none");
  const [newPriority, setNewPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [newDuration, setNewDuration] = useState(1);
  const [newAutoPosition, setNewAutoPosition] = useState(false);

  // Task detail panel
  const [selectedTask, setSelectedTask] = useState<FullTask | null>(null);
  const [selectedCollectionForPanel, setSelectedCollectionForPanel] = useState<string | null>(null);

  const project = projects?.find(p => p.id === projectId);

  // Build last column map for "done" detection
  const lastColumnIds = useMemo(() => {
    const map = new Map<string, string>();
    if (!allColumns) return map;
    const byCol = new Map<string, typeof allColumns>();
    for (const c of allColumns) {
      const arr = byCol.get(c.collection_id) || [];
      arr.push(c);
      byCol.set(c.collection_id, arr);
    }
    for (const [cid, cols] of byCol) {
      const sorted = cols.sort((a, b) => a.position - b.position);
      if (sorted.length) map.set(cid, sorted[sorted.length - 1].id);
    }
    return map;
  }, [allColumns]);

  const projectTasks = useMemo(() => {
    return (allTasks?.filter(t => (t as any).project_id === projectId && !(t as any).is_archived) || []) as FullTaskWithCollection[];
  }, [allTasks, projectId]);

  const stats = useMemo(() => {
    const total = projectTasks.length;
    const done = projectTasks.filter(t => (t as any).is_done).length;
    const todayStr = new Date().toISOString().split("T")[0];
    const overdue = projectTasks.filter(t => {
      if (!project) return false;
      const lastCol = lastColumnIds.get(t.collection_id);
      if (lastCol && t.column_id === lastCol) return false;
      const posDay = (t as any).position_day;
      const dur = (t as any).duration_days || 1;
      if (posDay == null) return false;
      const projectDays = Math.ceil((new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / 86400000) + 1;
      return posDay + dur - 1 > projectDays;
    }).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, overdue, percent };
  }, [projectTasks, lastColumnIds, project]);

  // Filtered tasks for table
  const filteredTasks = useMemo(() => {
    let tasks = [...projectTasks];
    if (filterCol !== "all") tasks = tasks.filter(t => t.collection_id === filterCol);
    if (filterAssignee !== "all") tasks = tasks.filter(t => t.assignee_id === filterAssignee);
    if (filterPositioned === "positioned") tasks = tasks.filter(t => (t as any).position_day != null);
    if (filterPositioned === "unpositioned") tasks = tasks.filter(t => (t as any).position_day == null);
    return tasks;
  }, [projectTasks, filterCol, filterAssignee, filterPositioned]);

  // Tasks available for association (no project)
  const availableTasks = useMemo(() => {
    return allTasks?.filter(t => !(t as any).project_id) || [];
  }, [allTasks]);

  const { data: panelColumns } = useColumns(selectedCollectionForPanel);

  if (!project) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full text-muted-foreground">Projeto não encontrado.</div>
      </AppLayout>
    );
  }

  const handleSaveName = () => {
    if (name.trim() && name !== project.name) {
      updateProject.mutate({ id: project.id, name: name.trim() });
    }
    setEditingName(false);
  };

  const handleSaveDesc = () => {
    const val = desc.trim() || null;
    if (val !== (project.description || null)) {
      updateProject.mutate({ id: project.id, description: val });
    }
    setEditingDesc(false);
  };

  const handleAssociateTask = async (taskId: string) => {
    await supabase.from("tasks").update({ project_id: project.id } as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    setShowAssociate(false);
    toast.success("Task associada ao projeto");
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !newColId) return;
    const cols = allColumns?.filter(c => c.collection_id === newColId).sort((a, b) => a.position - b.position);
    if (!cols || cols.length === 0) return;

    const hasAssignee = newAssignee !== "none";
    const useAutoPos = newAutoPosition && hasAssignee;

    try {
      if (useAutoPos) {
        const { error } = await supabase.functions.invoke("auto-create-task", {
          body: {
            title: newTitle.trim(),
            description: newDesc.trim() || null,
            collection_id: newColId,
            column_id: cols[0].id,
            assignee_id: newAssignee,
            priority: newPriority,
            project_id: project.id,
            duration_hours: newDuration,
            auto_position: true,
            daily_work_hours: dailyHours,
            work_start_hour: workStartHour,
            weekend_days: wsSettings?.weekend_days || [0, 6],
            holidays: wsHolidays?.map(h => h.holiday_date) || [],
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          collection_id: newColId,
          column_id: cols[0].id,
          created_by: user!.id,
          project_id: project.id,
          duration_hours: newDuration,
          priority: newPriority,
          assignee_id: hasAssignee ? newAssignee : null,
        } as any);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["schedule-overrides"] });
      setShowCreate(false);
      setNewTitle(""); setNewColId(""); setNewDesc(""); setNewAssignee("none"); setNewPriority("media"); setNewDuration(1); setNewAutoPosition(false);
      toast.success("Task criada e associada ao projeto");
    } catch {
      toast.error("Erro ao criar task");
    }
  };

  const handleDelete = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => { toast.success("Projeto excluído"); navigate("/projetos"); },
    });
  };

  const getColumnName = (columnId: string) => allColumns?.find(c => c.id === columnId)?.name || "—";
  const getProfileName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles?.find(p => p.user_id === userId)?.name || "—";
  };
  const getCollectionName = (collectionId: string) => collections?.find(c => c.id === collectionId)?.name || "—";

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/projetos")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <Input
                  value={name} onChange={e => setName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={e => e.key === "Enter" && handleSaveName()}
                  autoFocus className="font-heading text-xl font-bold h-auto py-1"
                />
              ) : (
                <h1
                  className="font-heading text-xl font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setName(project.name); setEditingName(true); }}
                >
                  {project.name}
                </h1>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/gantt?projeto=${project.id}`)}>
              <GanttChart className="h-4 w-4 mr-1" /> Ver no Gantt
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </div>

          {/* Description */}
          {editingDesc ? (
            <Textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              onBlur={handleSaveDesc}
              autoFocus placeholder="Adicionar descrição..." className="min-h-[60px]"
            />
          ) : (
            <p
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => { setDesc(project.description || ""); setEditingDesc(true); }}
            >
              {project.description || "Clique para adicionar descrição..."}
            </p>
          )}

          {/* Dates + Stats */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Início:</label>
              <Input
                type="date" value={project.start_date}
                onChange={e => updateProject.mutate({ id: project.id, start_date: e.target.value })}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Fim:</label>
              <Input
                type="date" value={project.end_date}
                onChange={e => updateProject.mutate({ id: project.id, end_date: e.target.value })}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{stats.total}</strong> tasks</span>
              <span><strong className="text-emerald-500">{stats.done}</strong> concluídas</span>
              {stats.overdue > 0 && <span><strong className="text-destructive">{stats.overdue}</strong> atrasadas</span>}
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[120px] max-w-[200px]">
              <Progress value={stats.percent} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{stats.percent}%</span>
            </div>
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-auto">
          {/* Filters + Actions */}
          <div className="flex items-center gap-2 px-6 py-3 border-b flex-wrap">
            <Select value={filterCol} onValueChange={setFilterCol}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Coleção" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas coleções</SelectItem>
                {collections?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {profiles?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPositioned} onValueChange={setFilterPositioned}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Posição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="positioned">Posicionadas</SelectItem>
                <SelectItem value="unpositioned">Não posicionadas</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => setShowAssociate(true)}>
                <LinkIcon className="h-3.5 w-3.5 mr-1" /> Associar task
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Criar task
              </Button>
            </div>
          </div>

          {/* Table */}
          {filteredTasks.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Nenhuma task encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left px-6 py-2 font-medium">Título</th>
                    <th className="text-left px-3 py-2 font-medium">Coleção</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Responsável</th>
                    <th className="text-center px-3 py-2 font-medium">Duração</th>
                    <th className="text-center px-3 py-2 font-medium">Posição</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => {
                    const posDay = (task as any).position_day;
                    const duration = (task as any).duration_hours || 1;
                    const lastCol = lastColumnIds.get(task.collection_id);
                    const isDone = lastCol && task.column_id === lastCol;
                    return (
                      <tr
                        key={task.id}
                        className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedTask(task);
                          setSelectedCollectionForPanel(task.collection_id);
                        }}
                      >
                        <td className="px-6 py-2.5">
                          <span className={cn("font-medium", isDone && "line-through text-muted-foreground")}>{task.title}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{getCollectionName(task.collection_id)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{getColumnName(task.column_id)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{getProfileName(task.assignee_id)}</td>
                        <td className="px-3 py-2.5 text-center text-xs">{duration}h</td>
                        <td className="px-3 py-2.5 text-center text-xs">
                          {posDay != null ? (
                            <span className="text-muted-foreground">Dia {posDay}</span>
                          ) : (
                            <span className="text-amber-500">Não posicionada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Associate task modal */}
      <Dialog open={showAssociate} onOpenChange={setShowAssociate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Associar task existente</DialogTitle></DialogHeader>
          <div className="max-h-[300px] overflow-auto space-y-1">
            {availableTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todas as tasks já estão em projetos.</p>
            ) : (
              availableTasks.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => handleAssociateTask(t.id)}
                >
                  <span className="text-sm flex-1 truncate">{t.title}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t.collections?.name}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create task modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Criar task no projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título da task" className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descreva a task..." className="mt-1 min-h-[60px]" />
            </div>
            <div>
              <label className="text-sm font-medium">Coleção *</label>
              <Select value={newColId} onValueChange={setNewColId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar coleção" /></SelectTrigger>
                <SelectContent>
                  {collections?.filter(c => !c.is_archived).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Select value={newAssignee} onValueChange={(v) => { setNewAssignee(v); if (v === "none") setNewAutoPosition(false); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newAssignee !== "none" && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                <Checkbox
                  id="auto-position-project"
                  checked={newAutoPosition}
                  onCheckedChange={(checked) => setNewAutoPosition(!!checked)}
                />
                <label htmlFor="auto-position-project" className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Posicionar automaticamente na agenda
                </label>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Duracao (horas)</label>
              <div className="flex items-center gap-1 mt-1">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setNewDuration(Math.max(0.5, newDuration - 0.5))}>-</Button>
                <Input type="number" min={0.5} step={0.5} value={newDuration} onChange={e => { const v = parseFloat(e.target.value); if (v >= 0.5) setNewDuration(v); }} className="text-center h-9" />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setNewDuration(newDuration + 0.5)}>+</Button>
              </div>
              {(
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatHoursDuration(newDuration, dailyHours)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={!newTitle.trim() || !newColId}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        columns={panelColumns || []}
        profiles={profiles || []}
        onClose={() => setSelectedTask(null)}
      />
    </AppLayout>
  );
}
