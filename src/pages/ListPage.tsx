import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, LayoutGrid, List as ListIcon, Calendar, GanttChart, Search, Filter as FilterIcon, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList, useStatuses, useCreateTask, useUpdateTask, type Task } from "@/hooks/useListData";
import { ListView } from "@/components/list-views/ListView";
import { KanbanView } from "@/components/list-views/KanbanView";
import { CalendarView } from "@/components/list-views/CalendarView";
import { GanttView } from "@/components/list-views/GanttView";
import { TaskModal } from "@/components/TaskModal";

export default function ListPage() {
  const { listId } = useParams<{ listId: string }>();
  const { data: list } = useList(listId);
  const { data: statuses = [] } = useStatuses(listId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setModalOpen(true); };

  const filter = useMemo(() => (t: Task) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (statusFilter !== "all" && t.status_id !== statusFilter) return false;
    return true;
  }, [search, priorityFilter, statusFilter]);

  const clearFilters = () => { setSearch(""); setPriorityFilter("all"); setStatusFilter("all"); };
  const hasFilters = search || priorityFilter !== "all" || statusFilter !== "all";

  if (!listId) return <AppLayout><div className="p-8">Lista não encontrada</div></AppLayout>;

  const breadcrumb = list ? [list.space_name, list.folder_name, list.name].filter(Boolean).join(" / ") : "";

  const handleSubmit = (patch: Partial<Task>) => {
    if (editing) updateTask.mutate({ id: editing.id, patch });
    else createTask.mutate({ list_id: listId, title: patch.title!, ...patch });
  };

  return (
    <AppLayout>
      <div className="border-b p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{breadcrumb}</p>
          <h1 className="text-xl font-semibold truncate">{list?.name || "…"}</h1>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova tarefa</Button>
      </div>

      <div className="border-b px-4 py-2 flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="h-8 pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-3.5 w-3.5 mr-1" />Limpar</Button>}
      </div>

      <Tabs defaultValue="list" className="w-full">
        <div className="border-b px-4">
          <TabsList className="h-10 bg-transparent p-0 gap-1">
            <TabsTrigger value="list" className="data-[state=active]:bg-muted"><ListIcon className="h-4 w-4 mr-1" />Lista</TabsTrigger>
            <TabsTrigger value="kanban" className="data-[state=active]:bg-muted"><LayoutGrid className="h-4 w-4 mr-1" />Kanban</TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-muted"><Calendar className="h-4 w-4 mr-1" />Calendário</TabsTrigger>
            <TabsTrigger value="gantt" className="data-[state=active]:bg-muted"><GanttChart className="h-4 w-4 mr-1" />Gantt</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="list" className="mt-0"><ListView listId={listId} onOpenTask={openEdit} filter={filter} /></TabsContent>
        <TabsContent value="kanban" className="mt-0"><KanbanView listId={listId} onOpenTask={openEdit} filter={filter} /></TabsContent>
        <TabsContent value="calendar" className="mt-0"><CalendarView listId={listId} onOpenTask={openEdit} filter={filter} /></TabsContent>
        <TabsContent value="gantt" className="mt-0"><GanttView listId={listId} onOpenTask={openEdit} filter={filter} /></TabsContent>
      </Tabs>

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        listId={listId}
        breadcrumb={breadcrumb}
        task={editing}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
