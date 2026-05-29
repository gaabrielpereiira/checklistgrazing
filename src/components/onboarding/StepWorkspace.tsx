import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  workspaceId: string | null;
  onSaved: () => void;
  registerSave: (fn: () => Promise<boolean>) => void;
}

export function StepWorkspace({ workspaceId, onSaved, registerSave }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle().then(({ data }) => {
      setName(data?.name || "");
      setLoading(false);
    });
  }, [workspaceId]);

  useEffect(() => {
    registerSave(async () => {
      if (!workspaceId) return true;
      if (!name.trim()) {
        toast.error("Informe um nome para o workspace");
        return false;
      }
      const { error } = await supabase.from("workspaces").update({ name: name.trim() }).eq("id", workspaceId);
      if (error) {
        toast.error("Erro ao salvar workspace");
        return false;
      }
      onSaved();
      return true;
    });
  }, [name, workspaceId, registerSave, onSaved]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Seu workspace</h2>
          <p className="text-sm text-muted-foreground">Como sua empresa ou time se chama?</p>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Nome do workspace</label>
        <Input
          placeholder="Ex: Acme Corp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="h-11"
        />
      </div>
    </div>
  );
}
