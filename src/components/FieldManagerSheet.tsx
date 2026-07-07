import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Eye, EyeOff, GripVertical } from "lucide-react";
import { useCustomFields, useCreateField, useUpdateField, useDeleteField, type CustomFieldType } from "@/hooks/useCustomFields";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto", number: "Número", select: "Dropdown", date: "Data",
  checkbox: "Checkbox", user: "Usuário", url: "URL", email: "E-mail",
};

export function FieldManagerSheet({ listId, trigger }: { listId: string; trigger: React.ReactNode }) {
  const { data: fields = [] } = useCustomFields(listId);
  const create = useCreateField();
  const update = useUpdateField();
  const del = useDeleteField();
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");

  const add = () => {
    if (!name.trim()) return;
    create.mutate({ list_id: listId, name: name.trim(), type }, {
      onSuccess: () => { setName(""); setType("text"); },
    });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[420px] flex flex-col">
        <SheetHeader><SheetTitle>Campos personalizados</SheetTitle></SheetHeader>

        <div className="border rounded-lg p-3 space-y-2 mt-4">
          <Label className="text-xs">Novo campo</Label>
          <div className="flex gap-2">
            <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="flex-1" />
            <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!name.trim()} size="sm" className="w-full"><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
        </div>

        <div className="flex-1 overflow-auto mt-4 space-y-1">
          {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum campo personalizado.</p>}
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-2 border rounded-md p-2 group">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                defaultValue={f.name}
                onBlur={(e) => e.target.value !== f.name && update.mutate({ id: f.id, list_id: listId, patch: { name: e.target.value } })}
                className="h-7 border-0 shadow-none focus-visible:ring-0 px-0 flex-1"
              />
              <span className="text-[10px] uppercase text-muted-foreground shrink-0">{TYPE_LABELS[f.type]}</span>
              <button
                title={f.is_visible ? "Ocultar" : "Mostrar"}
                onClick={() => update.mutate({ id: f.id, list_id: listId, patch: { is_visible: !f.is_visible } })}
                className="text-muted-foreground hover:text-foreground"
              >
                {f.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => confirm("Excluir campo e todos os valores?") && del.mutate({ id: f.id, list_id: listId })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {fields.some((f) => f.type === "select") && (
          <div className="border-t pt-3 mt-2 text-xs text-muted-foreground">
            Opções de dropdowns podem ser editadas em detalhe numa próxima iteração.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
