import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomField } from "@/hooks/useCustomFields";

export type FilterOperator = "eq" | "neq" | "contains" | "empty" | "not_empty" | "gt" | "lt" | "between";
export type LogicMode = "AND" | "OR";
export interface FilterCondition {
  id: string;
  field: string; // 'title'|'status_id'|'priority'|'assignee_id'|'due_date' or custom:<uuid>
  op: FilterOperator;
  value: any;
}

export interface FilterState {
  logic: LogicMode;
  conditions: FilterCondition[];
}

interface Props {
  value: FilterState;
  onChange: (v: FilterState) => void;
  statuses: { id: string; name: string }[];
  profiles: { user_id: string; name: string }[];
  customFields: CustomField[];
}

const FIXED_FIELDS = [
  { value: "title", label: "Título", type: "text" as const },
  { value: "status_id", label: "Status", type: "select" as const },
  { value: "priority", label: "Prioridade", type: "priority" as const },
  { value: "assignee_id", label: "Responsável", type: "user" as const },
  { value: "due_date", label: "Prazo", type: "date" as const },
];

const OP_LABELS: Record<FilterOperator, string> = {
  eq: "é",
  neq: "não é",
  contains: "contém",
  empty: "está vazio",
  not_empty: "não está vazio",
  gt: "maior que",
  lt: "menor que",
  between: "entre",
};

function opsFor(type: string): FilterOperator[] {
  if (type === "text") return ["contains", "eq", "neq", "empty", "not_empty"];
  if (type === "date") return ["eq", "gt", "lt", "empty", "not_empty"];
  if (type === "number") return ["eq", "gt", "lt", "empty", "not_empty"];
  return ["eq", "neq", "empty", "not_empty"];
}

export function FilterBuilder({ value, onChange, statuses, profiles, customFields }: Props) {
  const allFields = [
    ...FIXED_FIELDS,
    ...customFields.map((f) => ({ value: `custom:${f.id}`, label: f.name, type: f.type as any })),
  ];

  const getFieldType = (fv: string) => allFields.find((f) => f.value === fv)?.type || "text";

  const addCondition = () =>
    onChange({
      ...value,
      conditions: [...value.conditions, { id: crypto.randomUUID(), field: "title", op: "contains", value: "" }],
    });

  const remove = (id: string) => onChange({ ...value, conditions: value.conditions.filter((c) => c.id !== id) });
  const patch = (id: string, p: Partial<FilterCondition>) =>
    onChange({ ...value, conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...p } : c)) });

  const renderValue = (c: FilterCondition) => {
    const type = getFieldType(c.field);
    if (c.op === "empty" || c.op === "not_empty") return null;
    if (c.field === "status_id") {
      return (
        <Select value={c.value || ""} onValueChange={(v) => patch(c.id, { value: v })}>
          <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (c.field === "assignee_id") {
      return (
        <Select value={c.value || ""} onValueChange={(v) => patch(c.id, { value: v })}>
          <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (c.field === "priority") {
      return (
        <Select value={c.value || ""} onValueChange={(v) => patch(c.id, { value: v })}>
          <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (type === "date") return <Input type="date" value={c.value || ""} onChange={(e) => patch(c.id, { value: e.target.value })} className="h-8 flex-1" />;
    if (type === "checkbox")
      return (
        <Select value={String(c.value ?? "true")} onValueChange={(v) => patch(c.id, { value: v === "true" })}>
          <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="true">Marcado</SelectItem><SelectItem value="false">Desmarcado</SelectItem></SelectContent>
        </Select>
      );
    return <Input value={c.value || ""} onChange={(e) => patch(c.id, { value: e.target.value })} className="h-8 flex-1" placeholder="Valor" />;
  };

  return (
    <div className="w-[520px] p-3 space-y-2">
      {value.conditions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Combinar com</span>
          <Select value={value.logic} onValueChange={(v) => onChange({ ...value, logic: v as LogicMode })}>
            <SelectTrigger className="h-7 w-24"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="AND">E</SelectItem><SelectItem value="OR">OU</SelectItem></SelectContent>
          </Select>
        </div>
      )}

      {value.conditions.map((c) => {
        const type = getFieldType(c.field);
        return (
          <div key={c.id} className="flex items-center gap-1.5">
            <Select value={c.field} onValueChange={(v) => patch(c.id, { field: v, value: "" })}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{allFields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={c.op} onValueChange={(v) => patch(c.id, { op: v as FilterOperator })}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{opsFor(type).map((o) => <SelectItem key={o} value={o}>{OP_LABELS[o]}</SelectItem>)}</SelectContent>
            </Select>
            {renderValue(c)}
            <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1" />Adicionar condição
      </Button>
    </div>
  );
}

// Runtime evaluator
export function applyFilters(tasks: any[], filter: FilterState, fieldValues: Record<string, Record<string, any>>): any[] {
  if (filter.conditions.length === 0) return tasks;
  return tasks.filter((t) => {
    const results = filter.conditions.map((c) => evalCondition(t, c, fieldValues));
    return filter.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
  });
}

function evalCondition(task: any, c: FilterCondition, fieldValues: Record<string, Record<string, any>>): boolean {
  const getVal = () => {
    if (c.field.startsWith("custom:")) {
      const fid = c.field.slice(7);
      return fieldValues[task.id]?.[fid];
    }
    return task[c.field];
  };
  const v = getVal();
  const cv = c.value;
  switch (c.op) {
    case "eq": return v === cv;
    case "neq": return v !== cv;
    case "contains": return String(v ?? "").toLowerCase().includes(String(cv ?? "").toLowerCase());
    case "empty": return v == null || v === "" || (Array.isArray(v) && v.length === 0);
    case "not_empty": return !(v == null || v === "" || (Array.isArray(v) && v.length === 0));
    case "gt": return v != null && cv != null && v > cv;
    case "lt": return v != null && cv != null && v < cv;
    default: return true;
  }
}
