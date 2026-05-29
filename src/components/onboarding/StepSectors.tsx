import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  workspaceId: string | null;
  registerSave: (fn: () => Promise<boolean>) => void;
}

export function StepSectors({ workspaceId, registerSave }: Props) {
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from("sectors").select("id, name").eq("workspace_id", workspaceId).order("created_at");
    setSectors(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [workspaceId]);

  useEffect(() => {
    registerSave(async () => {
      if (sectors.length === 0) {
        toast.error("Crie ao menos um setor para continuar");
        return false;
      }
      return true;
    });
  }, [sectors.length, registerSave]);

  const addSector = async () => {
    if (!newName.trim() || !workspaceId) return;
    const { error } = await supabase.from("sectors").insert({ name: newName.trim(), workspace_id: workspaceId });
    if (error) {
      toast.error("Erro ao criar setor");
      return;
    }
    setNewName("");
    load();
  };

  const removeSector = async (id: string) => {
    await supabase.from("sectors").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Setores</h2>
          <p className="text-sm text-muted-foreground">Áreas/departamentos do seu workspace.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Ex: Marketing, Vendas, TI"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSector()}
          className="h-11"
        />
        <Button onClick={addSector} className="h-11 gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && sectors.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nenhum setor ainda. Crie o primeiro acima.</p>
        )}
        {sectors.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2">
            <span className="text-sm font-medium">{s.name}</span>
            <Button variant="ghost" size="icon" onClick={() => removeSector(s.id)} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
