import { useState, useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfileWithSector, TaskPriority } from "@/hooks/useTaskData";

export interface KanbanFilterState {
  assignee: string; // "all" or user_id
  priority: string; // "all" | TaskPriority
  deadline: string; // "all" | "overdue" | "today" | "this_week" | "no_date"
}

const PRIORITY_LABELS: Record<string, string> = {
  all: "Todas",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const DEADLINE_LABELS: Record<string, string> = {
  all: "Todos",
  overdue: "Atrasadas",
  today: "Hoje",
  this_week: "Esta semana",
  no_date: "Sem prazo",
};

interface Props {
  filters: KanbanFilterState;
  onChange: (filters: KanbanFilterState) => void;
  profiles: ProfileWithSector[];
}

export function KanbanFilters({ filters, onChange, profiles }: Props) {
  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.assignee !== "all") count++;
    if (filters.priority !== "all") count++;
    if (filters.deadline !== "all") count++;
    return count;
  }, [filters]);

  const hasActive = activeCount > 0;

  const reset = () => onChange({ assignee: "all", priority: "all", deadline: "all" });

  return (
    <div className="flex items-center gap-2 border-b px-6 py-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mr-1">
        <Filter className="h-3.5 w-3.5" />
        Filtros
        {hasActive && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
            {activeCount}
          </Badge>
        )}
      </div>

      {/* Responsável */}
      <Select value={filters.assignee} onValueChange={(v) => onChange({ ...filters, assignee: v })}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="unassigned">Sem responsável</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.user_id} value={p.user_id}>
              {p.name || p.email || "Sem nome"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prioridade */}
      <Select value={filters.priority} onValueChange={(v) => onChange({ ...filters, priority: v })}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prazo */}
      <Select value={filters.deadline} onValueChange={(v) => onChange({ ...filters, deadline: v })}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Prazo" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(DEADLINE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs gap-1 text-muted-foreground">
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}

/** Client-side filter logic */
export function applyKanbanFilters<T extends { assignee_id: string | null; priority: string; due_date: string | null }>(
  tasks: T[],
  filters: KanbanFilterState
): T[] {
  const today = new Date().toISOString().split("T")[0];

  return tasks.filter((t) => {
    // Assignee filter
    if (filters.assignee !== "all") {
      if (filters.assignee === "unassigned") {
        if (t.assignee_id) return false;
      } else if (t.assignee_id !== filters.assignee) {
        return false;
      }
    }

    // Priority filter
    if (filters.priority !== "all" && t.priority !== filters.priority) return false;

    // Deadline filter
    if (filters.deadline !== "all") {
      switch (filters.deadline) {
        case "overdue":
          if (!t.due_date || t.due_date >= today) return false;
          break;
        case "today":
          if (t.due_date !== today) return false;
          break;
        case "this_week": {
          if (!t.due_date) return false;
          const d = new Date(t.due_date + "T00:00:00");
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          if (d < startOfWeek || d > endOfWeek) return false;
          break;
        }
        case "no_date":
          if (t.due_date) return false;
          break;
      }
    }

    return true;
  });
}
