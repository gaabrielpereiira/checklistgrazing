import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useTasks, useStatuses, useProfiles, useUpdateTask, useDeleteTask, type Task } from "@/hooks/useListData";
import { useCustomFields, useFieldValues, useUpsertFieldValue, type CustomField } from "@/hooks/useCustomFields";
import { useSubtasks, useCreateSubtask } from "@/hooks/useSubtasks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  listId: string;
  onOpenTask: (task: Task) => void;
  filterFn?: (t: Task) => boolean;
}

type SortKey = string;
type SortDir = "asc" | "desc";

const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };

function CustomCell({ task, field, value, listId }: { task: Task; field: CustomField; value: any; listId: string }) {
  const upsert = useUpsertFieldValue();
  const save = (v: any) => upsert.mutate({ task_id: task.id, field_id: field.id, value: v, list_id: listId });
  switch (field.type) {
    case "checkbox":
      return <Switch checked={!!value} onCheckedChange={save} />;
    case "date":
      return <Input type="date" defaultValue={value || ""} onBlur={(e) => e.target.value !== value && save(e.target.value || null)} className="h-7 text-xs border-0 shadow-none focus-visible:ring-1" onClick={(e) => e.stopPropagation()} />;
    case "number":
      return <Input type="number" defaultValue={value ?? ""} onBlur={(e) => save(e.target.value === "" ? null : Number(e.target.value))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-1" onClick={(e) => e.stopPropagation()} />;
    default:
      return <Input defaultValue={value ?? ""} onBlur={(e) => save(e.target.value || null)} className="h-7 text-xs border-0 shadow-none focus-visible:ring-1" onClick={(e) => e.stopPropagation()} />;
  }
}

function SubtaskRow({ sub, listId, cols }: { sub: Task; listId: string; cols: number }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  return (
    <div className="border-b bg-muted/10 pl-10 flex items-center hover:bg-muted/30">
      <Checkbox checked={sub.is_done} onCheckedChange={(c) => update.mutate({ id: sub.id, patch: { is_done: !!c } })} className="mr-2" />
      <Input
        defaultValue={sub.title}
        onBlur={(e) => e.target.value !== sub.title && update.mutate({ id: sub.id, patch: { title: e.target.value } })}
        className={cn("h-7 border-0 shadow-none focus-visible:ring-0 flex-1 text-sm", sub.is_done && "line-through text-muted-foreground")}
      />
      <button onClick={() => del.mutate({ id: sub.id, list_id: listId })} className="text-muted-foreground hover:text-destructive p-2">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TaskRow({ task, listId, onOpenTask, status, assignee, fieldValues, customFields }: {
  task: Task; listId: string; onOpenTask: (t: Task) => void;
  status: any; assignee: any; fieldValues: Record<string, any>; customFields: CustomField[];
}) {
  const [expanded, setExpanded] = useState(false);
  const update = useUpdateTask();
  const del = useDeleteTask();
  const { data: subtasks = [] } = useSubtasks(expanded ? task.id : undefined);
  const createSub = useCreateSubtask();
  const [newSub, setNewSub] = useState("");

  const visibleCustomFields = customFields.filter((f) => f.is_visible);
  const gridTemplate = `20px minmax(200px,3fr) 140px 120px 140px 160px ${visibleCustomFields.map(() => "140px").join(" ")} 40px`;

  return (
    <>
      <div className="grid items-center border-b hover:bg-muted/40 cursor-pointer" style={{ gridTemplateColumns: gridTemplate }} onClick={() => onOpenTask(task)}>
        <button
          className="flex items-center justify-center p-1 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="px-3 py-2 truncate flex items-center gap-2">
          <Checkbox
            checked={task.is_done}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(c) => update.mutate({ id: task.id, patch: { is_done: !!c } })}
          />
          <span className={cn("truncate", task.is_done && "line-through text-muted-foreground")}>{task.title}</span>
        </div>
        <div className="px-3 py-2">
          {status ? (
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />{status.name}
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </div>
        <div className="px-3 py-2"><PriorityBadge priority={task.priority} /></div>
        <div className="px-3 py-2 text-sm">
          {task.due_date ? new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}
          {task.due_time && <span className="text-xs text-muted-foreground ml-1">{task.due_time.slice(0, 5)}</span>}
        </div>
        <div className="px-3 py-2 text-sm truncate">{assignee?.name || <span className="text-muted-foreground">—</span>}</div>
        {visibleCustomFields.map((f) => (
          <div key={f.id} className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
            <CustomCell task={task} field={f} value={fieldValues[f.id]} listId={listId} />
          </div>
        ))}
        <div className="px-3 py-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenTask(task)}><Pencil className="h-3.5 w-3.5 mr-2" />Editar</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => del.mutate({ id: task.id, list_id: listId })}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded && (
        <>
          {subtasks.map((s) => <SubtaskRow key={s.id} sub={s} listId={listId} cols={visibleCustomFields.length + 6} />)}
          <div className="border-b bg-muted/10 pl-10 flex items-center">
            <Input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSub.trim()) {
                  createSub.mutate({ parent_task_id: task.id, list_id: listId, title: newSub.trim() });
                  setNewSub("");
                }
              }}
              placeholder="+ Adicionar subtarefa"
              className="h-8 border-0 shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
        </>
      )}
    </>
  );
}

export function ListView({ listId, onOpenTask, filterFn }: Props) {
  const { data: tasks = [] } = useTasks(listId);
  const { data: statuses = [] } = useStatuses(listId);
  const { data: profiles = [] } = useProfiles();
  const { data: customFields = [] } = useCustomFields(listId);
  const { data: fieldValues = {} } = useFieldValues(listId);

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const statusById = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);
  const profileById = useMemo(() => Object.fromEntries((profiles as any[]).map((p) => [p.user_id, p])), [profiles]);

  const parents = useMemo(() => tasks.filter((t) => !t.parent_task_id), [tasks]);

  const rows = useMemo(() => {
    const filtered = filterFn ? parents.filter(filterFn) : parents;
    const sorted = [...filtered].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey.startsWith("custom:")) {
        const fid = sortKey.slice(7);
        av = fieldValues[a.id]?.[fid] ?? "";
        bv = fieldValues[b.id]?.[fid] ?? "";
      } else if (sortKey === "status") { av = statusById[a.status_id || ""]?.position ?? -1; bv = statusById[b.status_id || ""]?.position ?? -1; }
      else if (sortKey === "priority") { av = priorityWeight[a.priority]; bv = priorityWeight[b.priority]; }
      else if (sortKey === "due_date") { av = a.due_date || ""; bv = b.due_date || ""; }
      else if (sortKey === "assignee") { av = profileById[a.assignee_id || ""]?.name || ""; bv = profileById[b.assignee_id || ""]?.name || ""; }
      else { av = String((a as any)[sortKey] ?? "").toLowerCase(); bv = String((b as any)[sortKey] ?? "").toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [parents, filterFn, sortKey, sortDir, statusById, profileById, fieldValues]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const Header = ({ k, label }: { k: SortKey; label: string }) => (
    <button className="flex items-center gap-1 text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => toggleSort(k)}>
      {label}
      {sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  const visibleCustomFields = customFields.filter((f) => f.is_visible);
  const gridTemplate = `20px minmax(200px,3fr) 140px 120px 140px 160px ${visibleCustomFields.map(() => "140px").join(" ")} 40px`;

  return (
    <div className="w-full">
      <div className="grid items-center border-b bg-muted/30 sticky top-0 z-[1]" style={{ gridTemplateColumns: gridTemplate }}>
        <span />
        <Header k="title" label="Título" />
        <Header k="status" label="Status" />
        <Header k="priority" label="Prioridade" />
        <Header k="due_date" label="Prazo" />
        <Header k="assignee" label="Responsável" />
        {visibleCustomFields.map((f) => (<Header key={f.id} k={`custom:${f.id}`} label={f.name} />))}
        <span />
      </div>
      {rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa.</div>}
      {rows.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          listId={listId}
          onOpenTask={onOpenTask}
          status={statusById[t.status_id || ""]}
          assignee={profileById[t.assignee_id || ""]}
          fieldValues={fieldValues[t.id] || {}}
          customFields={customFields}
        />
      ))}
    </div>
  );
}
