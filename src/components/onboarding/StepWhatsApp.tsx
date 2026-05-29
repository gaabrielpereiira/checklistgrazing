import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, QrCode, Loader2, CheckCircle, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type View = "intro" | "credentials" | "qr" | "connected";

export function StepWhatsApp() {
  const [view, setView] = useState<View>("intro");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.from("whatsapp_instances").select("id, status").eq("is_active", true).then(({ data }) => {
      const connected = data?.find((i: any) => i.status === "connected");
      if (connected) {
        setActiveId(connected.id);
        setView("connected");
      }
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchQr = useCallback(async (id: string) => {
    const { data } = await supabase.functions.invoke("get-evolution-qrcode", { body: { instance_id: id } });
    if (data?.connected) {
      setQrCode(null);
      setView("connected");
      if (pollRef.current) clearInterval(pollRef.current);
    } else if (data?.qr_code) {
      setQrCode(data.qr_code);
    }
  }, []);

  const handleCreate = async () => {
    if (!apiUrl.trim() || !apiKey.trim() || !instanceName.trim() || !displayName.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setCreating(true);
    const { data: profile } = await supabase.from("profiles").select("workspace_id").maybeSingle();
    const { data, error } = await supabase.functions.invoke("create-evolution-instance", {
      body: {
        api_url: apiUrl.trim(),
        api_key: apiKey.trim(),
        instance_name: instanceName.trim(),
        name: displayName.trim(),
        workspace_id: profile?.workspace_id,
      },
    });
    setCreating(false);
    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao criar instância");
      return;
    }
    setActiveId(data.instance_id);
    setQrCode(data.qr_code);
    setView("qr");
    pollRef.current = setInterval(() => fetchQr(data.instance_id), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <MessageSquare className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">WhatsApp <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h2>
          <p className="text-sm text-muted-foreground">Conecte via Evolution API para receber notificações e usar a IA por WhatsApp.</p>
        </div>
      </div>

      {view === "intro" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium">O que você precisa:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Uma instância de Evolution API rodando</li>
              <li>URL base e API Key globais</li>
              <li>Celular com WhatsApp à mão para escanear QR Code</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setView("credentials")} className="flex-1 h-11">Configurar agora</Button>
            <Button variant="outline" onClick={() => toast.info("Você pode configurar depois nas Configurações → WhatsApp")} className="h-11 gap-2">
              <SkipForward className="h-4 w-4" /> Pular
            </Button>
          </div>
        </div>
      )}

      {view === "credentials" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Evolution API URL</label>
            <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://evo.exemplo.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">API Key</label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sua-api-key" type="password" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome técnico</label>
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value.replace(/\s+/g, "-").toLowerCase())} placeholder="taskai-main" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome de exibição</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="WhatsApp principal" />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full h-11 gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {creating ? "Criando instância..." : "Criar e gerar QR Code"}
          </Button>
        </div>
      )}

      {view === "qr" && (
        <div className="flex flex-col items-center space-y-3 py-2">
          {qrCode ? (
            <div className="rounded-xl border border-border bg-white p-3">
              <img src={qrCode} alt="QR Code" className="w-56 h-56" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Aguardando QR Code...
            </div>
          )}
          <p className="text-sm text-center text-muted-foreground max-w-xs">
            Abra o WhatsApp → Mais opções → Aparelhos conectados → Conectar um aparelho.
          </p>
          <Button variant="ghost" size="sm" onClick={() => activeId && fetchQr(activeId)}>Atualizar QR</Button>
        </div>
      )}

      {view === "connected" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
          <p className="font-semibold">WhatsApp conectado!</p>
          <p className="text-sm text-muted-foreground">Tudo pronto para receber e enviar mensagens.</p>
        </div>
      )}
    </div>
  );
}
