import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GripVertical, Plus, Trash2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ColorPicker";

const TEMPLATES: Record<string, string[]> = {
  "Desenvolvimento": ["Backlog", "Em Progresso", "Code Review", "Pronto p/ Teste", "Concluído"],
  "Comercial": ["Prospecção", "Qualificação", "Proposta", "Negociação", "Fechado"],
  "Marketing": ["Ideias", "Planejamento", "Em Produção", "Revisão", "Publicado"],
  "Suporte": ["Novo", "Em Análise", "Em Andamento", "Aguardando Cliente", "Resolvido"],
};

const DEFAULT_COLUMNS = ["Pessoal", "Grazing", "Outro"];

interface NewCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, columns: string[], color: string | null) => void;
  loading?: boolean;
}

export function NewCollectionModal({ open, onOpenChange, onConfirm, loading }: NewCollectionModalProps) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<string[]>([...DEFAULT_COLUMNS]);
  const [newColName, setNewColName] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setColumns([...DEFAULT_COLUMNS]);
    setNewColName("");
    setDragIdx(null);
    setSelectedTemplate(null);
    setColor(null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const applyTemplate = (tpl: string) => {
    if (selectedTemplate === tpl) {
      setSelectedTemplate(null);
      setColumns([...DEFAULT_COLUMNS]);
    } else {
      setSelectedTemplate(tpl);
      setColumns([...TEMPLATES[tpl]]);
    }
  };

  const addColumn = () => {
    const val = newColName.trim();
    if (!val) return;
    setColumns(prev => [...prev, val]);
    setNewColName("");
  };

  const removeColumn = (idx: number) => {
    if (columns.length <= 2) return;
    setColumns(prev => prev.filter((_, i) => i !== idx));
  };

  const updateColumn = (idx: number, value: string) => {
    setColumns(prev => prev.map((c, i) => (i === idx ? value : c)));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setColumns(prev => {
      const arr = [...prev];
      const [removed] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, removed);
      return arr;
    });
    setDragIdx(null);
  };

  const canConfirm = name.trim().length > 0 && columns.length >= 2 && columns.every(c => c.trim().length > 0);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(name.trim(), columns.map(c => c.trim()), color);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Coleção</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="col-name">Nome da coleção</Label>
            <Input
              id="col-name"
              placeholder="Ex: Desenvolvimento, Comercial…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Cor da coleção</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="space-y-2">
            <Label>Templates (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(TEMPLATES).map(tpl => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedTemplate === tpl
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent"
                  )}
                >
                  <Layers className="h-3 w-3" />
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Columns list */}
          <div className="space-y-2">
            <Label>Colunas ({columns.length})</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {columns.map((col, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 transition-opacity",
                    dragIdx === idx && "opacity-50"
                  )}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground shrink-0" />
                  <Input
                    value={col}
                    onChange={(e) => updateColumn(idx, e.target.value)}
                    className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeColumn(idx)}
                    disabled={columns.length <= 2}
                    className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {/* Add column */}
            <div className="flex gap-2">
              <Input
                placeholder="Nova coluna…"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColumn())}
                className="h-8 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addColumn} className="shrink-0 h-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {columns.length < 2 && (
              <p className="text-xs text-destructive">Mínimo de 2 colunas.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || loading}>
            {loading ? "Criando…" : "Criar Coleção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
