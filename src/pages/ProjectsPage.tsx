import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useProjects, useCreateProject, useAllTasks, useAllColumns } from "@/hooks/useTaskData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FolderOpen, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

export default function ProjectsPage() {
  const { data: projects } = useProjects();
  const { data: allTasks } = useAllTasks();
  const { data: allColumns } = useAllColumns();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreate = () => {
    if (!name.trim() || !startDate || !endDate) return;
    createProject.mutate(
      { name: name.trim(), description: description.trim() || null, start_date: startDate, end_date: endDate },
      {
        onSuccess: () => {
          setShowModal(false);
          setName("");
          setDescription("");
          setStartDate("");
          setEndDate("");
        },
      }
    );
  };

  // Build last column map
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

  const getProjectStats = (projectId: string) => {
    const tasks = allTasks?.filter(t => (t as any).project_id === projectId) || [];
    const total = tasks.length;
    const done = tasks.filter(t => {
      const lastCol = lastColumnIds.get(t.collection_id);
      return lastCol && t.column_id === lastCol;
    }).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b px-6 py-3 shrink-0">
          <h1 className="font-heading text-xl font-bold mr-4">Projetos</h1>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!projects || projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <FolderOpen className="h-12 w-12 opacity-30" />
              <p>Nenhum projeto criado ainda.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map(project => {
                const stats = getProjectStats(project.id);
                const today = new Date().toISOString().split("T")[0];
                const isOverdue = project.end_date < today;
                return (
                  <div
                    key={project.id}
                    className="rounded-xl border bg-card p-5 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => navigate(`/projetos/${project.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-heading font-semibold text-card-foreground">{project.name}</h3>
                      {isOverdue && (
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Atrasado</span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(project.start_date).toLocaleDateString("pt-BR")} — {new Date(project.end_date).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{stats.total} tasks</span>
                        <span>{stats.percent}%</span>
                      </div>
                      <Progress value={stats.percent} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do projeto" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Data de início *</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Data de fim *</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !startDate || !endDate}>Criar Projeto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
