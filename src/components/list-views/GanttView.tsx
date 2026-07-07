import { useMemo } from "react";
import { useTasks, type Task } from "@/hooks/useListData";
import { cn } from "@/lib/utils";

function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

export function GanttView({ listId, onOpenTask, filter }: { listId: string; onOpenTask: (t: Task) => void; filter?: (t: Task) => boolean }) {
  const { data: tasks = [] } = useTasks(listId);

  const items = useMemo(() => {
    let base = tasks.filter((t) => !t.parent_task_id);
    if (filter) base = base.filter(filter);
    return base.filter((t) => t.start_date && t.due_date);
  }, [tasks, filter]);


  const { min, max, days } = useMemo(() => {
    if (items.length === 0) {
      const today = new Date();
      return { min: today, max: new Date(today.getTime() + 30 * 86400000), days: 30 };
    }
    const dates = items.flatMap((t) => [t.start_date, t.due_date].filter(Boolean) as string[]);
    const minD = new Date(dates.sort()[0] + "T00:00:00");
    const maxD = new Date(dates.sort().slice(-1)[0] + "T00:00:00");
    const days = Math.max(daysBetween(minD, maxD) + 1, 14);
    return { min: minD, max: maxD, days };
  }, [items]);

  const colWidth = 28;
  const totalWidth = days * colWidth;

  return (
    <div className="overflow-auto">
      <div className="flex" style={{ minWidth: totalWidth + 220 }}>
        <div className="w-56 shrink-0 border-r">
          <div className="h-10 border-b bg-muted/30 flex items-center px-3 text-xs font-semibold uppercase text-muted-foreground">Tarefa</div>
          {items.map((t) => (
            <div key={t.id} className="h-10 border-b flex items-center px-3 text-sm truncate cursor-pointer hover:bg-muted/40" onClick={() => onOpenTask(t)}>
              {t.title}
            </div>
          ))}
          {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">Tarefas com data de início e prazo aparecem aqui.</div>}
        </div>
        <div className="flex-1 relative">
          <div className="h-10 border-b bg-muted/30 flex sticky top-0">
            {Array.from({ length: days }).map((_, i) => {
              const d = new Date(min.getTime() + i * 86400000);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i} className={cn("shrink-0 border-r text-[10px] text-center py-1", isWeekend && "bg-muted/40")} style={{ width: colWidth }}>
                  <div className="text-muted-foreground">{d.toLocaleDateString("pt-BR", { weekday: "narrow" })}</div>
                  <div className="font-medium">{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {items.map((t) => {
            const s = new Date(t.start_date! + "T00:00:00");
            const e = new Date(t.due_date! + "T00:00:00");
            const offset = daysBetween(min, s);
            const span = Math.max(1, daysBetween(s, e) + 1);
            return (
              <div key={t.id} className="h-10 border-b relative">
                <div
                  className="absolute top-1.5 h-7 rounded-md bg-primary/80 text-primary-foreground text-xs flex items-center px-2 cursor-pointer hover:bg-primary"
                  style={{ left: offset * colWidth, width: span * colWidth - 4 }}
                  onClick={() => onOpenTask(t)}
                >
                  <span className="truncate">{t.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
