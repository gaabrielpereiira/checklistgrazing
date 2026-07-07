import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layout, CheckCircle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  workspaceId: string | null;
  registerSave: (fn: () => Promise<boolean>) => void;
}

export function StepCollection({ workspaceId, registerSave }: Props) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from("collections").select("id, name").eq("workspace_id", workspaceId).eq("is_archived", false).order("created_at");
    setCollections(data || []);
  };

  useEffect(() => {
    load();
  }, [workspaceId]);

  useEffect(() => {
    registerSave(async () => {
      if (collections.length === 0) {
        toast.error("Crie ao menos uma coleção");
        return false;
      }
      return true;
    });
  }, [collections.length, registerSave]);

  const create = async () => {
    if (!newName.trim() || !workspaceId || !user) return;
    setCreating(true);
    const { data: col, error } = await supabase
      .from("collections")
      .insert({ name: newName.trim(), workspace_id: workspaceId, created_by: user.id })
      .select()
      .single();
    if (error || !col) {
      toast.error("Erro ao criar coleção");
      setCreating(false);
      return;
    }
    // Create default columns
    const defaultCols = [
      { name: "Pessoal", position: 0, color: "#94a3b8" },
      { name: "Grazing", position: 1, color: "#3b82f6" },
      { name: "Outro", position: 2, color: "#10b981" },
    ];
    await supabase.from("columns").insert(defaultCols.map(c => ({ ...c, collection_id: col.id })));
    setNewName("");
    setCreating(false);
    load();
    toast.success("Coleção criada!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Layout className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Sua primeira coleção</h2>
          <p className="text-sm text-muted-foreground">Cada coleção é um board Kanban com colunas customizáveis.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Ex: Projetos 2026"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          className="h-11"
          disabled={creating}
        />
        <Button onClick={create} className="h-11 gap-2" disabled={creating || !newName.trim()}>
          <Plus className="h-4 w-4" /> Criar
        </Button>
      </div>
      <div className="space-y-2">
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhuma coleção ainda. Crie a primeira acima — vamos adicionar 3 colunas padrão (Pessoal / Grazing / Outro).</p>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">{c.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
