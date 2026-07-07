import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useTasks, useStatuses, useProfiles, useUpdateTask, useDeleteTask, type Task } from "@/hooks/useListData";

interface Props {
  listId: string;
  onOpenTask: (task: Task) => void;
  filter?: (t: Task) => boolean;
}

type SortKey = "title" | "status" | "priority" | "due_date" | "assignee";
type SortDir = "asc" | "desc";

const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };

export function ListView({ listId, onOpenTask, filter }: Props) {
  const { data: tasks = [] } = useTasks(listId);
  const { data: statuses = [] } = useStatuses(listId);
  const { data: profiles = [] } = useProfiles();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const statusById = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);
  const profileById = useMemo(() => Object.fromEntries((profiles as any[]).map((p) => [p.user_id, p])), [profiles]);

  const rows = useMemo(() => {
    const filtered = filter ? tasks.filter(filter) : tasks;
    const rows = [...filtered];
    rows.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case "status": av = statusById[a.status_id || ""]?.position ?? -1; bv = statusById[b.status_id || ""]?.position ?? -1; break;
        case "priority": av = priorityWeight[a.priority]; bv = priorityWeight[b.priority]; break;
        case "due_date": av = a.due_date || ""; bv = b.due_date || ""; break;
        case "assignee": av = profileById[a.assignee_id || ""]?.name || ""; bv = profileById[b.assignee_id || ""]?.name || ""; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [tasks, filter, sortKey, sortDir, statusById, profileById]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const Header = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <button className={cn("flex items-center gap-1 text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground", className)} onClick={() => toggleSort(k)}>
      {label}
      {sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-[minmax(200px,3fr)_140px_120px_140px_160px_40px] items-center border-b bg-muted/30">
        <Header k="title" label="Título" />
        <Header k="status" label="Status" />
        <Header k="priority" label="Prioridade" />
        <Header k="due_date" label="Prazo" />
        <Header k="assignee" label="Responsável" />
        <span />
      </div>
      {rows.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa. Clique em "+ Task" acima para criar.</div>
      )}
      {rows.map((t) => {
        const s = statusById[t.status_id || ""];
        const p = profileById[t.assignee_id || ""];
        return (
          <div key={t.id} className="grid grid-cols-[minmax(200px,3fr)_140px_120px_140px_160px_40px] items-center border-b hover:bg-muted/40 cursor-pointer" onClick={() => onOpenTask(t)}>
            <div className="px-3 py-2 truncate">
              <span className={cn("truncate", t.is_done && "line-through text-muted-foreground")}>{t.title}</span>
            </div>
            <div className="px-3 py-2">
              {s ? (
                <span className="inline-flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              ) : <span className="text-xs text-muted-foreground">—</span>}
            </div>
            <div className="px-3 py-2"><PriorityBadge priority={t.priority} /></div>
            <div className="px-3 py-2 text-sm">
              {t.due_date ? new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}
              {t.due_time && <span className="text-xs text-muted-foreground ml-1">{t.due_time.slice(0,5)}</span>}
            </div>
            <div className="px-3 py-2 text-sm truncate">{p?.name || <span className="text-muted-foreground">—</span>}</div>
            <div className="px-3 py-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onOpenTask(t)}><Pencil className="h-3.5 w-3.5 mr-2" />Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => update.mutate({ id: t.id, patch: { is_done: !t.is_done } })}>
                    {t.is_done ? "Marcar não concluída" : "Marcar concluída"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => del.mutate({ id: t.id, list_id: listId })}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
