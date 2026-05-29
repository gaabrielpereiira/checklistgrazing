import { useState, useEffect } from "react";
import { Settings, Plus, Trash2, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Column, Collection, ColumnConnection, ProfileWithSector, TaskPriority, ColumnAutomation, AssigneeConfig } from "@/hooks/useTaskData";

// ─── TimeOptionsEditor (inline) ───
function TimeOptionsEditor({ timeOptions, onChange }: { timeOptions: number[]; onChange: (opts: number[]) => void }) {
  const [newVal, setNewVal] = useState("");

  const addOption = () => {
    const val = parseFloat(newVal);
    if (isNaN(val) || val < 0.5) return;
    if (timeOptions.includes(val)) return;
    onChange([...timeOptions, val].sort((a, b) => a - b));
    setNewVal("");
  };

  return (
    <div className="pl-3 space-y-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Opções de tempo</span>
      {timeOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {timeOptions.map(h => (
            <span key={h} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {h}h
              <button onClick={() => onChange(timeOptions.filter(v => v !== h))} className="text-muted-foreground hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input
          type="number"
          min="0.5"
          step="0.5"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
          placeholder="Horas"
          className="h-6 w-16 text-[10px]"
        />
        <Button type="button" variant="outline" size="sm" onClick={addOption} className="h-6 px-1.5 text-[10px]">
          <Plus className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── AssigneeConfigEditor (inline) ───
function AssigneeConfigEditor({
  config,
  profiles,
  onChange,
}: {
  config: AssigneeConfig;
  profiles: ProfileWithSector[];
  onChange: (config: AssigneeConfig) => void;
}) {
  const mode = config?.mode || "inherit";
  const [candidateId, setCandidateId] = useState("");

  return (
    <div className="pl-3 space-y-1.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Responsável do novo card
      </span>
      <Select
        value={mode}
        onValueChange={(v) => {
          if (v === "inherit") onChange(null);
          else if (v === "none") onChange({ mode: "none" });
          else if (v === "fixed") onChange({ mode: "fixed", user_id: "" });
          else if (v === "choose") onChange({ mode: "choose", candidates: [] });
        }}
      >
        <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="inherit" className="text-xs">Herdar do card original</SelectItem>
          <SelectItem value="none" className="text-xs">Sem responsável</SelectItem>
          <SelectItem value="fixed" className="text-xs">Responsável fixo</SelectItem>
          <SelectItem value="choose" className="text-xs">Escolha do usuário</SelectItem>
        </SelectContent>
      </Select>

      {config?.mode === "fixed" && (
        <Select
          value={config.user_id || ""}
          onValueChange={(v) => onChange({ mode: "fixed", user_id: v })}
        >
          <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {config?.mode === "choose" && (
        <div className="space-y-1">
          {config.candidates.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {config.candidates.map((uid) => {
                const name = profiles.find((p) => p.user_id === uid)?.name || uid.slice(0, 8);
                return (
                  <span key={uid} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                    {name}
                    <button
                      onClick={() => onChange({ mode: "choose", candidates: config.candidates.filter((c) => c !== uid) })}
                      className="text-muted-foreground hover:text-destructive"
                    >×</button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex gap-1">
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue placeholder="Adicionar" /></SelectTrigger>
              <SelectContent>
                {profiles.filter((p) => !config.candidates.includes(p.user_id)).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="sm"
              className="h-6 px-1.5 text-[10px]"
              disabled={!candidateId}
              onClick={() => {
                if (candidateId) {
                  onChange({ mode: "choose", candidates: [...config.candidates, candidateId] });
                  setCandidateId("");
                }
              }}
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const COLUMN_COLORS = [
  { name: "Padrão", value: "" },
  { name: "Azul", value: "hsl(220 70% 50%)" },
  { name: "Verde", value: "hsl(142 71% 45%)" },
  { name: "Amarelo", value: "hsl(38 92% 50%)" },
  { name: "Vermelho", value: "hsl(0 72% 51%)" },
  { name: "Roxo", value: "hsl(270 70% 55%)" },
  { name: "Rosa", value: "hsl(330 70% 55%)" },
  { name: "Ciano", value: "hsl(190 80% 45%)" },
  { name: "Laranja", value: "hsl(25 95% 53%)" },
];

const PRIORITIES: { label: string; value: TaskPriority }[] = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Urgente", value: "urgente" },
];

export type { ColumnAutomation } from "@/hooks/useTaskData";

interface ColumnConfigPopoverProps {
  column: Column;
  collections: Collection[];
  currentCollectionId: string;
  allColumns: (Column & { collections: { name: string } | null })[];
  connections: ColumnConnection[];
  automations: ColumnAutomation[];
  profiles: ProfileWithSector[];
  onUpdateColumn: (id: string, updates: Partial<Column>) => void;
  onCreateConnection: (sourceId: string, targetId: string) => void;
  onDeleteConnection: (id: string) => void;
  onUpdateConnectionTimeOptions: (id: string, timeOptions: number[] | null) => void;
  onUpdateConnectionAssignee: (id: string, config: AssigneeConfig) => void;
  onCreateAutomation: (columnId: string, type: string, value: string) => void;
  onDeleteAutomation: (id: string) => void;
}

export function ColumnConfigPopover({
  column,
  collections,
  currentCollectionId,
  allColumns,
  connections,
  automations,
  profiles,
  onUpdateColumn,
  onCreateConnection,
  onDeleteConnection,
  onUpdateConnectionTimeOptions,
  onUpdateConnectionAssignee,
  onCreateAutomation,
  onDeleteAutomation,
}: ColumnConfigPopoverProps) {
  const [wipLimit, setWipLimit] = useState(String((column as any).wip_limit || 0));
  const [selectedColor, setSelectedColor] = useState((column as any).color || "");
  const [connCollectionId, setConnCollectionId] = useState<string>("");
  const [connColumnId, setConnColumnId] = useState<string>("");
  const [autoType, setAutoType] = useState<string>("");
  const [autoValue, setAutoValue] = useState<string>("");

  // Connections for this column
  const colConnections = connections.filter(c => c.source_column_id === column.id);

  // Other collections for connection setup
  const otherCollections = collections.filter(c => c.id !== currentCollectionId && !c.is_archived);
  const targetColumns = connCollectionId
    ? allColumns.filter(c => (c as any).collection_id === connCollectionId)
    : [];

  // Debug: log para verificar dados
  

  // Column automations
  const colAutomations = automations.filter(a => a.column_id === column.id);

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    onUpdateColumn(column.id, { color: color || null } as any);
  };

  const handleWipChange = () => {
    const val = parseInt(wipLimit) || 0;
    onUpdateColumn(column.id, { wip_limit: val } as any);
  };

  const handleAddConnection = () => {
    if (!connColumnId) return;
    onCreateConnection(column.id, connColumnId);
    setConnCollectionId("");
    setConnColumnId("");
  };

  const handleAddAutomation = () => {
    if (!autoType || !autoValue) return;
    onCreateAutomation(column.id, autoType, autoValue);
    setAutoType("");
    setAutoValue("");
  };

  // Resolve connection target names
  const getConnectionLabel = (conn: ColumnConnection) => {
    const targetCol = allColumns.find(c => c.id === conn.target_column_id);
    if (!targetCol) return "Desconhecido";
    return `${targetCol.collections?.name || "?"} → ${targetCol.name}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          title="Configurar coluna"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom">
        <div className="p-3 border-b">
          <h4 className="text-sm font-semibold">Configurar: {column.name}</h4>
        </div>

        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {/* Appearance */}
          <div className="p-3 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aparência</h5>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cor da coluna</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLUMN_COLORS.map(c => (
                  <button
                    key={c.value || "default"}
                    onClick={() => handleColorChange(c.value)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                      selectedColor === c.value ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c.value || "hsl(var(--muted))" }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* WIP Limit */}
            <div className="space-y-1.5">
              <Label className="text-xs">Limite WIP (0 = sem limite)</Label>
              <Input
                type="number"
                min="0"
                value={wipLimit}
                onChange={(e) => setWipLimit(e.target.value)}
                onBlur={handleWipChange}
                onKeyDown={(e) => e.key === "Enter" && handleWipChange()}
                className="h-7 text-sm w-20"
              />
            </div>
          </div>

          <Separator />

          {/* Connections */}
          <div className="p-3 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conexão de saída</h5>
            <p className="text-[11px] text-muted-foreground">
              Quando um card chegar nesta coluna, criar card vinculado em:
            </p>

            {/* Active connections */}
            {colConnections.length > 0 && (
              <div className="space-y-3">
                {colConnections.map(conn => {
                  const timeOpts = (conn as any).time_options as number[] | null;
                  return (
                    <div key={conn.id} className="space-y-1.5">
                      <div className="flex items-center justify-between rounded-md bg-accent/50 px-2 py-1.5 text-xs">
                        <span className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-primary" />
                          {getConnectionLabel(conn)}
                        </span>
                        <button onClick={() => onDeleteConnection(conn.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Time options */}
                      <TimeOptionsEditor
                        timeOptions={timeOpts || []}
                        onChange={(opts) => onUpdateConnectionTimeOptions(conn.id, opts.length > 0 ? opts : null)}
                      />
                      {/* Assignee config */}
                      <AssigneeConfigEditor
                        config={conn.assignee_config}
                        profiles={profiles}
                        onChange={(cfg) => onUpdateConnectionAssignee(conn.id, cfg)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add connection */}
            {otherCollections.length > 0 ? (
              <div className="space-y-2">
                <Select value={connCollectionId} onValueChange={(v) => { setConnCollectionId(v); setConnColumnId(""); }}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Coleção destino" /></SelectTrigger>
                  <SelectContent>
                    {otherCollections.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connCollectionId && (
                  <Select value={connColumnId} onValueChange={setConnColumnId}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Coluna destino" /></SelectTrigger>
                    <SelectContent>
                      {targetColumns.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" size="sm" onClick={handleAddConnection} disabled={!connColumnId} className="w-full h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar conexão
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Crie outras coleções para configurar conexões.</p>
            )}
          </div>

          <Separator />

          {/* Automations */}
          <div className="p-3 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automação</h5>

            {/* Existing automations */}
            {colAutomations.length > 0 && (
              <div className="space-y-1.5">
                {colAutomations.map(auto => (
                  <div key={auto.id} className="flex items-center justify-between rounded-md bg-accent/50 px-2 py-1.5 text-xs">
                    <span>
                      {auto.type === "assign_user" && `Atribuir: ${profiles.find(p => p.user_id === auto.value)?.name || auto.value}`}
                      {auto.type === "set_priority" && `Prioridade: ${PRIORITIES.find(p => p.value === auto.value)?.label || auto.value}`}
                      {auto.type === "complete_task" && "Concluir task"}
                      {auto.type === "archive_task" && "Arquivar task"}
                    </span>
                    <button onClick={() => onDeleteAutomation(auto.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add automation */}
            <div className="space-y-2">
              <Select value={autoType} onValueChange={(v) => { setAutoType(v); setAutoValue(v === "complete_task" || v === "archive_task" ? "true" : ""); }}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Tipo de automação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assign_user" className="text-xs">Atribuir responsável</SelectItem>
                  <SelectItem value="set_priority" className="text-xs">Mudar prioridade</SelectItem>
                  <SelectItem value="complete_task" className="text-xs">Concluir task</SelectItem>
                  <SelectItem value="archive_task" className="text-xs">Arquivar task</SelectItem>
                </SelectContent>
              </Select>

              {autoType === "assign_user" && (
                <Select value={autoValue} onValueChange={setAutoValue}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecionar usuário" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {autoType === "set_priority" && (
                <Select value={autoValue} onValueChange={setAutoValue}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecionar prioridade" /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {autoType && (
                <Button variant="outline" size="sm" onClick={handleAddAutomation} disabled={!autoValue} className="w-full h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar automação
                </Button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
