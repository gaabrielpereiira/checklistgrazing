import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, ExternalLink, CheckCircle, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  workspaceId: string | null;
}

export function StepSlack({ workspaceId }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [secret, setSecret] = useState("");
  const [savedSecret, setSavedSecret] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) || "";
  const endpoint = projectId ? `https://${projectId}.supabase.co/functions/v1/slack-command` : "";

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("slack_settings").select("vault_signing_secret_id, is_enabled").eq("workspace_id", workspaceId).maybeSingle().then(({ data }) => {
      if (data) {
        setSavedSecret(!!data.vault_signing_secret_id);
        setEnabled(data.is_enabled);
      }
    });
  }, [workspaceId]);

  const save = async () => {
    if (!workspaceId) return;
    if (!secret.trim()) {
      toast.error("Cole o Signing Secret");
      return;
    }
    if (secret.startsWith("xoxb-") || secret.startsWith("xoxp-")) {
      toast.error("Esse é um Bot Token. Use o Signing Secret (em Basic Information → App Credentials).");
      return;
    }

    // 1. Store secret in Vault via edge function
    const { data: stored, error: storeErr } = await supabase.functions.invoke("store-api-key", {
      body: { service_name: "slack_signing", secret_value: secret.trim(), workspace_id: workspaceId, label: "Slack Signing Secret" },
    });
    if (storeErr || !stored?.success) {
      toast.error("Erro ao salvar no vault");
      return;
    }

    // 2. Upsert slack_settings with the vault reference
    const { data: existing } = await supabase.from("slack_settings").select("id").eq("workspace_id", workspaceId).maybeSingle();
    const payload = { workspace_id: workspaceId, vault_signing_secret_id: stored.vault_secret_id, is_enabled: enabled };
    const { error } = existing
      ? await supabase.from("slack_settings").update(payload).eq("workspace_id", workspaceId)
      : await supabase.from("slack_settings").insert(payload);
    if (error) {
      toast.error("Erro ao salvar configuração");
      return;
    }
    setSavedSecret(true);
    setSecret("");
    toast.success("Slack configurado!");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
          <MessageSquare className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Slack <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h2>
          <p className="text-sm text-muted-foreground">Use <code className="text-foreground">/taskai</code> direto no Slack.</p>
        </div>
      </div>

      {savedSecret && !skipped ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-sm font-semibold">Slack já configurado</p>
            <p className="text-xs text-muted-foreground">Você pode atualizar o secret nas Configurações.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
            <p className="font-medium">Passos:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Acesse <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-0.5">api.slack.com/apps <ExternalLink className="h-3 w-3" /></a> e crie um app.</li>
              <li>Em <strong>Slash Commands</strong>, crie <code>/taskai</code> com a Request URL:</li>
            </ol>
            <code className="block bg-background border border-border rounded px-2 py-1 text-[10px] break-all">{endpoint || "—"}</code>
            <ol start={3} className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Em <strong>Basic Information → App Credentials</strong>, copie o <strong>Signing Secret</strong>.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Signing Secret</label>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="32 chars hex (ex: 8a9b1c...)" type="password" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 h-11" disabled={!secret.trim()}>Salvar</Button>
            <Button variant="outline" onClick={() => { setSkipped(true); toast.info("Você pode configurar depois"); }} className="h-11 gap-2">
              <SkipForward className="h-4 w-4" /> Pular
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
