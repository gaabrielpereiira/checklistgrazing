import { useMemo } from "react";
import { useTasks, useStatuses, useUpdateTask, type Task } from "@/hooks/useListData";
import { PriorityBadge } from "@/components/PriorityBadge";
import { cn } from "@/lib/utils";

export function KanbanView({ listId, onOpenTask, filter }: { listId: string; onOpenTask: (t: Task) => void; filter?: (t: Task) => boolean }) {
  const { data: tasks = [] } = useTasks(listId);
  const { data: statuses = [] } = useStatuses(listId);
  const update = useUpdateTask();

  const grouped = useMemo(() => {
    let base = tasks.filter((t) => !t.parent_task_id);
    if (filter) base = base.filter(filter);
    const map: Record<string, Task[]> = {};
    statuses.forEach((s) => (map[s.id] = []));
    map["__no__"] = [];
    base.forEach((t) => (map[t.status_id || "__no__"] ||= []).push(t));
    return map;
  }, [tasks, statuses, filter]);


  const handleDrop = (statusId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) update.mutate({ id, patch: { status_id: statusId } });
  };

  return (
    <div className="flex gap-4 p-4 overflow-x-auto min-h-full">
      {statuses.map((s) => (
        <div
          key={s.id}
          className="w-72 shrink-0 bg-muted/30 rounded-lg p-2 flex flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(s.id, e)}
        >
          <div className="flex items-center gap-2 px-2 py-2 sticky top-0">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-medium text-sm">{s.name}</span>
            <span className="text-xs text-muted-foreground">{grouped[s.id]?.length || 0}</span>
          </div>
          <div className="space-y-2">
            {grouped[s.id]?.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                onClick={() => onOpenTask(t)}
                className={cn("bg-background border rounded-md p-3 cursor-pointer hover:shadow-sm", t.is_done && "opacity-60")}
              >
                <p className={cn("text-sm font-medium", t.is_done && "line-through")}>{t.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <PriorityBadge priority={t.priority} />
                  {t.due_date && (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
