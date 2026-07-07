import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useStatuses } from "@/hooks/useListData";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColorPicker } from "@/components/ColorPicker";

const TYPES = [
  { value: "todo", label: "A fazer" },
  { value: "active", label: "Em progresso" },
  { value: "done", label: "Concluído" },
] as const;

export function StatusManagerSheet({ listId, trigger }: { listId: string; trigger: React.ReactNode }) {
  const { data: statuses = [] } = useStatuses(listId);
  const qc = useQueryClient();

  const inv = () => qc.invalidateQueries({ queryKey: ["statuses", listId] });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: any }) => {
      const { error } = await supabase.from("statuses").update(v.patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const create = useMutation({
    mutationFn: async () => {
      const nextPos = (statuses.at(-1)?.position ?? -1) + 1;
      const { error } = await supabase.from("statuses").insert({ list_id: listId, name: "Novo status", color: "#94a3b8", type: "active", position: nextPos });
      if (error) throw error;
    },
    onSuccess: inv,
  });

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[420px] flex flex-col">
        <SheetHeader><SheetTitle>Status da lista</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-auto mt-4 space-y-2">
          {statuses.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border rounded-md p-2">
              <ColorPicker value={s.color} onChange={(color) => update.mutate({ id: s.id, patch: { color } })} />
              <Input
                defaultValue={s.name}
                onBlur={(e) => e.target.value !== s.name && update.mutate({ id: s.id, patch: { name: e.target.value } })}
                className="h-8 flex-1"
              />
              <Select value={s.type} onValueChange={(v) => update.mutate({ id: s.id, patch: { type: v } })}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <button
                onClick={() => confirm("Excluir status? Tarefas ficarão sem status.") && del.mutate(s.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button onClick={() => create.mutate()} className="mt-3"><Plus className="h-4 w-4 mr-1" />Novo status</Button>
      </SheetContent>
    </Sheet>
  );
}
