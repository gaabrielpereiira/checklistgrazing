import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks, type Task } from "@/hooks/useListData";
import { cn } from "@/lib/utils";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

export function CalendarView({ listId, onOpenTask, filter }: { listId: string; onOpenTask: (t: Task) => void; filter?: (t: Task) => boolean }) {
  const { data: tasks = [] } = useTasks(listId);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startDay = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const filtered = useMemo(() => {
    let base = tasks.filter((t) => !t.parent_task_id);
    if (filter) base = base.filter(filter);
    return base;
  }, [tasks, filter]);

  const byDate = useMemo(() => {
    const m: Record<string, Task[]> = {};
    filtered.forEach((t) => { if (t.due_date) (m[t.due_date] ||= []).push(t); });
    return m;
  }, [filtered]);

  const monthName = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold capitalize">{monthName}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
          <div key={d} className="bg-muted/50 py-1.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
        ))}
        {cells.map((cell, i) => {
          const key = cell ? cell.toISOString().slice(0, 10) : `empty-${i}`;
          const dayTasks = cell ? byDate[key] || [] : [];
          const isToday = cell && key === today;
          return (
            <div key={key} className={cn("bg-background min-h-24 p-1.5", !cell && "bg-muted/20")}>
              {cell && (
                <>
                  <div className={cn("text-xs mb-1", isToday && "text-primary font-bold")}>{cell.getDate()}</div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button key={t.id} onClick={() => onOpenTask(t)} className="w-full text-left text-[11px] truncate bg-primary/10 text-primary hover:bg-primary/20 rounded px-1.5 py-0.5">
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
