import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Plus, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  workspaceId: string | null;
}

export function StepTeam({ workspaceId }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<{ id: string; email: string; status: string }[]>([]);

  const load = async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from("invites").select("id, email, status").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    setInvites(data || []);
  };

  useEffect(() => {
    load();
  }, [workspaceId]);

  const invite = async () => {
    if (!email.trim() || !workspaceId || !user) return;
    const { error } = await supabase.from("invites").insert({
      email: email.trim().toLowerCase(),
      workspace_id: workspaceId,
      invited_by: user.id,
      role: "usuario",
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Email já convidado" : "Erro ao convidar");
      return;
    }
    setEmail("");
    load();
    toast.success("Convite criado");
  };

  const remove = async (id: string) => {
    await supabase.from("invites").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Convide sua equipe</h2>
          <p className="text-sm text-muted-foreground">Opcional — você pode convidar depois nas Configurações.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="email@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          className="h-11"
        />
        <Button onClick={invite} className="h-11 gap-2" disabled={!email.trim()}>
          <Send className="h-4 w-4" /> Convidar
        </Button>
      </div>
      <div className="space-y-2 max-h-44 overflow-y-auto">
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhum convite enviado.</p>
        ) : (
          invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{i.email}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">{i.status}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(i.id)} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
