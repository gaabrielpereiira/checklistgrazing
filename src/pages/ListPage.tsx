import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus, LayoutGrid, List as ListIcon, Calendar, GanttChart, Search, Filter as FilterIcon,
  Sliders, X, MoreHorizontal, Save, Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  useList, useStatuses, useCreateTask, useUpdateTask, useProfiles, useTasks, type Task,
} from "@/hooks/useListData";
import { useCustomFields, useFieldValues, useSavedViews, useSaveView, useDeleteView, type SavedView } from "@/hooks/useCustomFields";
import { useDeleteNode } from "@/hooks/useWorkspaceTree";
import { ListView } from "@/components/list-views/ListView";
import { KanbanView } from "@/components/list-views/KanbanView";
import { CalendarView } from "@/components/list-views/CalendarView";
import { GanttView } from "@/components/list-views/GanttView";
import { TaskModal } from "@/components/TaskModal";
import { FieldManagerSheet } from "@/components/FieldManagerSheet";
import { StatusManagerSheet } from "@/components/StatusManagerSheet";
import { FilterBuilder, applyFilters, type FilterState } from "@/components/FilterBuilder";
import { toast } from "@/hooks/use-toast";

type ViewType = "list" | "kanban" | "calendar" | "gantt";

const EMPTY_FILTER: FilterState = { logic: "AND", conditions: [] };

export default function ListPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { data: list } = useList(listId);
  const { data: statuses = [] } = useStatuses(listId);
  const { data: profiles = [] } = useProfiles();
  const { data: tasks = [] } = useTasks(listId);
  const { data: customFields = [] } = useCustomFields(listId);
  const { data: fieldValues = {} } = useFieldValues(listId);
  const { data: savedViews = [] } = useSavedViews(listId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const saveView = useSaveView();
  const deleteView = useDeleteView();
  const deleteList = useDeleteNode();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [activeTab, setActiveTab] = useState<ViewType>("list");
  const [activeSavedView, setActiveSavedView] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState(false);
  const [viewName, setViewName] = useState("");

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setModalOpen(true); };

  const filteredTasks = useMemo(() => {
    let base = tasks;
    if (search) base = base.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    return applyFilters(base, filter, fieldValues);
  }, [tasks, search, filter, fieldValues]);

  const filterFn = (t: Task) => filteredTasks.some((f) => f.id === t.id);

  if (!listId) return <AppLayout><div className="p-8">Lista não encontrada</div></AppLayout>;

  const breadcrumb = list ? [list.space_name, list.folder_name, list.name].filter(Boolean).join(" / ") : "";

  const handleSubmit = (patch: Partial<Task>) => {
    if (editing) updateTask.mutate({ id: editing.id, patch });
    else createTask.mutate({ list_id: listId, title: patch.title!, ...patch });
  };

  const applySavedView = (view: SavedView) => {
    setActiveSavedView(view.id);
    setActiveTab(view.type);
    if (view.config?.filter) setFilter(view.config.filter);
    if (view.config?.search !== undefined) setSearch(view.config.search);
  };

  const handleSaveView = () => {
    if (!viewName.trim()) return;
    saveView.mutate(
      { list_id: listId, name: viewName.trim(), type: activeTab, config: { filter, search } },
      {
        onSuccess: () => {
          toast({ description: "View salva" });
          setSaveDialog(false); setViewName("");
        },
      },
    );
  };

  const activeFiltersCount = filter.conditions.length + (search ? 1 : 0);

  return (
    <AppLayout>
      <div className="border-b p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex items-center gap-2">
          <div>
            <p className="text-xs text-muted-foreground truncate">{breadcrumb}</p>
            <h1 className="text-xl font-semibold truncate">{list?.name || "…"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusManagerSheet listId={listId} trigger={<Button variant="outline" size="sm"><Sliders className="h-4 w-4 mr-1" />Status</Button>} />
          <FieldManagerSheet listId={listId} trigger={<Button variant="outline" size="sm"><Sliders className="h-4 w-4 mr-1" />Campos</Button>} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                if (confirm("Excluir lista?")) {
                  deleteList.mutate({ table: "lists", id: listId }, { onSuccess: () => navigate("/") });
                }
              }}><Trash2 className="h-3.5 w-3.5 mr-2" />Excluir lista</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova tarefa</Button>
        </div>
      </div>

      <div className="border-b px-4 py-2 flex items-center gap-2 flex-wrap">
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="h-8 pl-8" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <FilterIcon className="h-3.5 w-3.5 mr-1" />Filtros
              {activeFiltersCount > 0 && <Badge className="ml-2 h-4 px-1">{activeFiltersCount}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-auto">
            <FilterBuilder value={filter} onChange={setFilter} statuses={statuses} profiles={profiles as any} customFields={customFields} />
          </PopoverContent>
        </Popover>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setFilter(EMPTY_FILTER); setSearch(""); }}>
            <X className="h-3.5 w-3.5 mr-1" />Limpar
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Popover open={saveDialog} onOpenChange={setSaveDialog}>
            <PopoverTrigger asChild><Button variant="outline" size="sm"><Save className="h-3.5 w-3.5 mr-1" />Salvar view</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-2">
                <Input placeholder="Nome da view" value={viewName} onChange={(e) => setViewName(e.target.value)} />
                <Button onClick={handleSaveView} disabled={!viewName.trim()} size="sm" className="w-full">Salvar</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ViewType); setActiveSavedView(null); }} className="w-full">
        <div className="border-b px-4 flex items-center gap-1 flex-wrap">
          <TabsList className="h-10 bg-transparent p-0 gap-1">
            <TabsTrigger value="list" className="data-[state=active]:bg-muted"><ListIcon className="h-4 w-4 mr-1" />Lista</TabsTrigger>
            <TabsTrigger value="kanban" className="data-[state=active]:bg-muted"><LayoutGrid className="h-4 w-4 mr-1" />Kanban</TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-muted"><Calendar className="h-4 w-4 mr-1" />Calendário</TabsTrigger>
            <TabsTrigger value="gantt" className="data-[state=active]:bg-muted"><GanttChart className="h-4 w-4 mr-1" />Gantt</TabsTrigger>
          </TabsList>
          {savedViews.length > 0 && <div className="w-px h-6 bg-border mx-2" />}
          <div className="flex items-center gap-1 flex-wrap">
            {savedViews.map((v) => (
              <div key={v.id} className={`inline-flex items-center rounded-md text-sm ${activeSavedView === v.id ? "bg-muted" : ""}`}>
                <button onClick={() => applySavedView(v)} className="px-2 py-1">{v.name}</button>
                <button
                  onClick={() => { if (confirm(`Excluir view "${v.name}"?`)) deleteView.mutate({ id: v.id, list_id: listId }); }}
                  className="pr-1.5 opacity-40 hover:opacity-100 hover:text-destructive"
                ><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
        <TabsContent value="list" className="mt-0"><ListView listId={listId} onOpenTask={openEdit} filterFn={filterFn} /></TabsContent>
        <TabsContent value="kanban" className="mt-0"><KanbanView listId={listId} onOpenTask={openEdit} filter={filterFn} /></TabsContent>
        <TabsContent value="calendar" className="mt-0"><CalendarView listId={listId} onOpenTask={openEdit} filter={filterFn} /></TabsContent>
        <TabsContent value="gantt" className="mt-0"><GanttView listId={listId} onOpenTask={openEdit} filter={filterFn} /></TabsContent>
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
