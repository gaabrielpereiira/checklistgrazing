import { useState, useRef, useEffect } from "react";
import { Plus, MoreVertical, Link2, Pencil, Trash2, GripVertical, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ColumnConfigPopover, type ColumnAutomation } from "@/components/ColumnConfigPopover";
import type { Column, Collection, ColumnConnection, ProfileWithSector, AssigneeConfig } from "@/hooks/useTaskData";

interface KanbanColumnHeaderProps {
  column: Column;
  taskCount: number;
  overdueCount: number;
  hasConnection: boolean;
  isManager: boolean;
  totalColumns: number;
  otherColumns: Column[];
  // Config popover data
  collections: Collection[];
  currentCollectionId: string;
  allColumns: (Column & { collections: { name: string } | null })[];
  connections: ColumnConnection[];
  automations: ColumnAutomation[];
  profiles: ProfileWithSector[];
  // Handlers
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, moveToColumnId: string | null) => void;
  onAddTask: (columnId: string) => void;
  onUpdateColumn: (id: string, updates: Partial<Column>) => void;
  onCreateConnection: (sourceId: string, targetId: string) => void;
  onDeleteConnection: (id: string) => void;
  onUpdateConnectionTimeOptions: (id: string, timeOptions: number[] | null) => void;
  onUpdateConnectionAssignee: (id: string, config: AssigneeConfig) => void;
  onCreateAutomation: (columnId: string, type: string, value: string) => void;
  onDeleteAutomation: (id: string) => void;
  onDragStart: (e: React.DragEvent, columnId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
}

export function KanbanColumnHeader({
  column,
  taskCount,
  overdueCount,
  hasConnection,
  isManager,
  totalColumns,
  otherColumns,
  collections,
  currentCollectionId,
  allColumns,
  connections,
  automations,
  profiles,
  onRename,
  onDelete,
  onAddTask,
  onUpdateColumn,
  onCreateConnection,
  onDeleteConnection,
  onUpdateConnectionTimeOptions,
  onUpdateConnectionAssignee,
  onCreateAutomation,
  onDeleteAutomation,
  onDragStart,
  onDragOver,
  onDrop,
}: KanbanColumnHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(column.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveToColumn, setMoveToColumn] = useState<string | null>(otherColumns[0]?.id || null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const val = editValue.trim();
    if (val && val !== column.name) {
      onRename(column.id, val);
    } else {
      setEditValue(column.name);
    }
    setEditing(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(column.id, taskCount > 0 ? moveToColumn : null);
    setDeleteOpen(false);
  };

  const canDelete = totalColumns > 2;
  const wipLimit = (column as any).wip_limit || 0;
  const isOverWip = wipLimit > 0 && taskCount >= wipLimit;

  // Connection badges
  const colConnections = connections.filter(c => c.source_column_id === column.id);
  const connectionBadges = colConnections.map(conn => {
    const targetCol = allColumns.find(c => c.id === conn.target_column_id);
    return targetCol ? targetCol.collections?.name || "?" : null;
  }).filter(Boolean);

  return (
    <>
      <div
        className="mb-3 flex items-center justify-between px-1 group"
        draggable={isManager}
        onDragStart={(e) => {
          e.dataTransfer.setData("column-id", column.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart(e, column.id);
        }}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, column.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isManager && (
            <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
          {editing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setEditValue(column.name); setEditing(false); }
              }}
              className="h-6 text-xs font-semibold uppercase tracking-wider border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          ) : (
            <h3
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate cursor-default"
              onDoubleClick={() => isManager && setEditing(true)}
              title="Duplo-clique para renomear"
            >
              {column.name}
            </h3>
          )}
          {hasConnection && <Link2 className="h-3 w-3 text-primary shrink-0" />}
          {/* Connection destination badges */}
          {connectionBadges.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary shrink-0">
              <ArrowRight className="h-2.5 w-2.5" /> {name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {overdueCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-overdue/15 px-1.5 text-[10px] font-bold text-status-overdue">
              {overdueCount}
            </span>
          )}
          <span className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
            isOverWip
              ? "bg-destructive/15 text-destructive"
              : "bg-muted text-muted-foreground"
          )}>
            {taskCount}{wipLimit > 0 && `/${wipLimit}`}
          </span>
          <button
            onClick={() => onAddTask(column.id)}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            title="Adicionar task"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {isManager && (
            <ColumnConfigPopover
              column={column}
              collections={collections}
              currentCollectionId={currentCollectionId}
              allColumns={allColumns}
              connections={connections}
              automations={automations}
              profiles={profiles}
              onUpdateColumn={onUpdateColumn}
              onCreateConnection={onCreateConnection}
              onDeleteConnection={onDeleteConnection}
              onUpdateConnectionTimeOptions={onUpdateConnectionTimeOptions}
              onUpdateConnectionAssignee={onUpdateConnectionAssignee}
              onCreateAutomation={onCreateAutomation}
              onDeleteAutomation={onDeleteAutomation}
            />
          )}
          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => canDelete && setDeleteOpen(true)}
                  disabled={!canDelete}
                  className={cn(!canDelete && "opacity-50")}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Delete column dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir coluna "{column.name}"</DialogTitle>
            <DialogDescription>
              {taskCount > 0
                ? `Esta coluna tem ${taskCount} task(s). Escolha para qual coluna movê-las.`
                : "Esta coluna está vazia e será excluída."}
            </DialogDescription>
          </DialogHeader>
          {taskCount > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Mover tasks para:</label>
              <Select value={moveToColumn || ""} onValueChange={setMoveToColumn}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {otherColumns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {hasConnection && (
            <p className="text-sm text-status-attention">
              ⚠️ Esta coluna tem conexões de pipeline que serão removidas.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={taskCount > 0 && !moveToColumn}>
              Excluir Coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
