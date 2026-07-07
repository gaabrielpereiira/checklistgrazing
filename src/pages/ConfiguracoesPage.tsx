import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCollections, useCreateCollection, useAllColumns,
  useColumnConnections, useCreateColumnConnection, useDeleteColumnConnection,
  useSectors, useCreateSector, useDeleteSector,
  useProfiles, useUpdateProfile, useUserRoles,
  useUserSectors, useAddUserSector, useRemoveUserSector,
  useTeams, useCollectionTeams, useCollectionUsers,
  useAddCollectionTeam, useRemoveCollectionTeam,
  useAddCollectionUser, useRemoveCollectionUser,
} from "@/hooks/useTaskData";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Plus, Trash2, Link2, Users, Building2, Phone, MessageSquare, QrCode, Loader2, CheckCircle, RefreshCw, Wifi, WifiOff, Server, Key, Globe, AlertTriangle, Shield, Clock, Sparkles, Mail } from "lucide-react";
import { WorkScheduleSettings } from "@/components/WorkScheduleSettings";
import { toast } from "sonner";

// --- WhatsApp Integration Component ---
function WhatsAppIntegration({ profile }: { profile: any }) {
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone || "");
  const [whatsappNotifs, setWhatsappNotifs] = useState(profile?.whatsapp_notifications || false);

  // Evolution API credentials
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Instance management
  const [instances, setInstances] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [instanceName, setInstanceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  type ViewMode = "setup" | "instances" | "creating" | "qrcode" | "connected";
  const [viewMode, setViewMode] = useState<ViewMode>("setup");

  // Load instances
  useEffect(() => {
    const load = async () => {
      setLoadingInstances(true);
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const list = data || [];
      setInstances(list);

      const connected = list.find((i: any) => i.status === "connected");
      if (connected) {
        setActiveInstanceId(connected.id);
        setViewMode("connected");
      } else if (list.length > 0) {
        setViewMode("instances");
      } else {
        setViewMode("setup");
      }
      setLoadingInstances(false);
    };
    load();
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const fetchQr = useCallback(async (id: string) => {
    setIsFetchingQr(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-evolution-qrcode", {
        body: { instance_id: id },
      });
      if (error) throw error;
      if (data?.connected) {
        setQrCode(null);
        setViewMode("connected");
        stopPolling();
        // Reload instances
        const { data: updated } = await supabase.from("whatsapp_instances").select("*").eq("is_active", true).order("created_at", { ascending: false });
        setInstances(updated || []);
        toast.success("WhatsApp conectado! ✅");
      } else if (data?.qr_code) {
        setQrCode(data.qr_code);
      }
    } catch (err) {
      console.warn("QR fetch error:", err);
    } finally {
      setIsFetchingQr(false);
    }
  }, [stopPolling]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollingRef.current = setInterval(() => fetchQr(id), 5000);
  }, [fetchQr, stopPolling]);

  const handleTestConnection = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) { toast.error("Preencha URL e API Key"); return; }
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-evolution-connection", {
        body: { api_url: apiUrl.trim(), api_key: apiKey.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        setTestResult({ ok: true, message: "Conexão estabelecida!" });
        toast.success("Evolution API conectada! ✅");
      } else {
        setTestResult({ ok: false, message: data?.error || "Falha" });
      }
    } catch {
      setTestResult({ ok: false, message: "Erro de conexão" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    setInstanceName(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, ""));
  };

  const handleCreateInstance = async () => {
    if (!displayName.trim() || !instanceName.trim()) { toast.error("Preencha o nome da conexão"); return; }
    if (!apiUrl.trim() || !apiKey.trim()) { toast.error("Configure a URL e API Key primeiro"); return; }

    setIsCreating(true);
    setViewMode("creating");

    try {
      const { data: profileData } = await supabase.from("profiles").select("workspace_id").eq("user_id", (await supabase.auth.getUser()).data.user?.id).single();

      const { data, error } = await supabase.functions.invoke("create-evolution-instance", {
        body: {
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
          instance_name: instanceName,
          name: displayName,
          workspace_id: profileData?.workspace_id,
        },
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message || "Erro");

      setActiveInstanceId(data.instance_id);
      if (data.qr_code) {
        setQrCode(data.qr_code);
        setViewMode("qrcode");
        startPolling(data.instance_id);
      } else {
        setViewMode("qrcode");
        await fetchQr(data.instance_id);
        startPolling(data.instance_id);
      }

      // Reload instances
      const { data: updated } = await supabase.from("whatsapp_instances").select("*").eq("is_active", true).order("created_at", { ascending: false });
      setInstances(updated || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância");
      setViewMode("instances");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectInstance = (inst: any) => {
    setActiveInstanceId(inst.id);
    if (inst.status === "connected") {
      setViewMode("connected");
    } else {
      setViewMode("qrcode");
      fetchQr(inst.id);
      startPolling(inst.id);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    try {
      await supabase.functions.invoke("delete-evolution-instance", { body: { instance_id: id } });
      setInstances(prev => prev.filter(i => i.id !== id));
      if (activeInstanceId === id) {
        setActiveInstanceId(null);
        setViewMode("setup");
      }
      toast.success("Instância removida");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleSavePhone = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ phone: phoneNumber || null }).eq("id", profile.id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Telefone salvo!");
  };

  const handleToggleWhatsApp = async (checked: boolean) => {
    if (!profile) return;
    setWhatsappNotifs(checked);
    await supabase.from("profiles").update({ whatsapp_notifications: checked }).eq("id", profile.id);
  };

  if (loadingInstances) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const connectedInstance = instances.find(i => i.status === "connected");

  return (
    <div className="space-y-6">
      {/* Phone + notifications section */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-heading text-base font-semibold text-card-foreground">Seu número</h3>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Número de telefone (com DDD)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="+55 11 99999-9999" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={handleSavePhone}>Salvar</Button>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium text-card-foreground">Notificações WhatsApp</p>
            <p className="text-xs text-muted-foreground">Receba alertas de solicitações, prazos e atualizações</p>
          </div>
          <Switch checked={whatsappNotifs} onCheckedChange={handleToggleWhatsApp} />
        </div>
      </div>

      {/* Evolution API Setup */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div>
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-1">Evolution API</h3>
          <p className="text-sm text-muted-foreground">Configure a conexão com sua Evolution API para gerenciar o WhatsApp.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> URL da Evolution API
            </label>
            <Input value={apiUrl} onChange={(e) => { setApiUrl(e.target.value); setTestResult(null); }} placeholder="https://sua-evolution-api.com" className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Key className="h-3.5 w-3.5" /> API Key
            </label>
            <Input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }} placeholder="Sua chave de API" className="font-mono text-sm" />
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${testResult.ok ? "bg-primary/10 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
              {testResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {testResult.message}
            </div>
          )}

          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting || !apiUrl.trim() || !apiKey.trim()} className="w-full gap-2">
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            {isTesting ? "Testando..." : "Testar Conexão"}
          </Button>
        </div>
      </div>

      {/* Instance Management */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base font-semibold text-card-foreground mb-1">Instâncias WhatsApp</h3>
            <p className="text-sm text-muted-foreground">Crie e gerencie suas conexões WhatsApp.</p>
          </div>
          {connectedInstance && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-full">
              <Wifi className="h-3.5 w-3.5" /> Conectado
            </div>
          )}
        </div>

        {/* Connected state */}
        {viewMode === "connected" && connectedInstance && (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <h4 className="font-semibold text-card-foreground">{connectedInstance.name}</h4>
            <p className="text-sm text-muted-foreground">WhatsApp conectado e pronto para uso</p>
            {connectedInstance.phone_number && (
              <p className="text-xs text-muted-foreground">{connectedInstance.phone_number}</p>
            )}
          </div>
        )}

        {/* QR Code view */}
        {viewMode === "qrcode" && (
          <div className="rounded-xl border bg-muted/30 p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center">
              <QrCode className="h-7 w-7 text-muted-foreground" />
            </div>
            <h4 className="font-semibold text-card-foreground">Escaneie o QR Code</h4>
            <p className="text-sm text-muted-foreground">Abra o WhatsApp no celular → Menu → Aparelhos conectados → Conectar</p>

            {qrCode ? (
              <div className="bg-white rounded-xl p-4 inline-block mx-auto">
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-56 h-56" />
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => activeInstanceId && fetchQr(activeInstanceId)} disabled={isFetchingQr} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetchingQr ? "animate-spin" : ""}`} /> Atualizar QR
            </Button>
          </div>
        )}

        {/* Creating state */}
        {viewMode === "creating" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Criando instância...</p>
          </div>
        )}

        {/* Existing instances list */}
        {instances.length > 0 && viewMode !== "qrcode" && viewMode !== "creating" && (
          <div className="space-y-3">
            {instances.map((inst) => (
              <InstanceRow
                key={inst.id}
                instance={inst}
                onSelect={() => handleSelectInstance(inst)}
                onDelete={() => handleDeleteInstance(inst.id)}
                onUpdated={async () => {
                  const { data: updated } = await supabase.from("whatsapp_instances").select("*").eq("is_active", true).order("created_at", { ascending: false });
                  setInstances(updated || []);
                }}
              />
            ))}
          </div>
        )}

        {/* Create new instance form */}
        <div className="border-t pt-4 space-y-4">
          <h4 className="text-sm font-medium text-card-foreground">Nova instância</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome da conexão</label>
              <Input value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} placeholder="Ex: WhatsApp Principal" />
              {instanceName && (
                <p className="text-xs text-muted-foreground mt-1">ID: <code className="bg-muted px-1 rounded">{instanceName}</code></p>
              )}
            </div>
            <Button onClick={handleCreateInstance} disabled={isCreating || !displayName.trim() || !apiUrl.trim() || !apiKey.trim()} className="w-full gap-2">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isCreating ? "Criando..." : "Criar instância e gerar QR Code"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Single instance row with AI-allowed-phone, settings & webhook config ---
function InstanceRow({ instance, onSelect, onDelete, onUpdated }: { instance: any; onSelect: () => void; onDelete: () => void; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState<null | "ai" | "settings">(null);
  const [allowed, setAllowed] = useState<string>(instance.ai_allowed_phone || "");
  const [saving, setSaving] = useState(false);

  // Evolution settings state
  const [groupsIgnore, setGroupsIgnore] = useState(true);
  const [rejectCall, setRejectCall] = useState(false);
  const [msgCall, setMsgCall] = useState("");
  const [alwaysOnline, setAlwaysOnline] = useState(false);
  const [readMessages, setReadMessages] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reconfiguring, setReconfiguring] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const cleaned = allowed.replace(/\D/g, "") || null;
    const { error } = await supabase
      .from("whatsapp_instances")
      .update({ ai_allowed_phone: cleaned })
      .eq("id", instance.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(cleaned ? "IA restrita ao número configurado" : "Restrição removida — IA responde a qualquer usuário cadastrado");
    onUpdated();
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-evolution-settings", {
        body: {
          instance_id: instance.id,
          groups_ignore: groupsIgnore,
          reject_call: rejectCall,
          msg_call: rejectCall ? msgCall : "",
          always_online: alwaysOnline,
          read_messages: readMessages,
        },
      });
      if (error) throw error;
      if (data && (data as any).success === false) throw new Error((data as any).error || "Erro");
      toast.success("Configurações sincronizadas com a Evolution API");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReconfigureWebhook = async () => {
    setReconfiguring(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-evolution-settings", {
        body: { instance_id: instance.id, reconfigure_webhook: true, webhook_enabled: true },
      });
      if (error) throw error;
      if (data && (data as any).success === false) throw new Error((data as any).error || "Erro");
      toast.success(`Webhook reconfigurado para ${instance.name} ✅`);
    } catch (err: any) {
      toast.error("Falha ao reconfigurar webhook: " + (err?.message || "desconhecido"));
    } finally {
      setReconfiguring(false);
    }
  };

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center justify-between p-3">
        <button onClick={onSelect} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${instance.status === "connected" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
            {instance.status === "connected" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-card-foreground truncate">{instance.name}</p>
            <p className="text-xs text-muted-foreground">
              {instance.status === "connected" ? "Conectado" : "Desconectado"} • {instance.instance_name}
              {instance.ai_allowed_phone && <span className="ml-2 text-primary">• IA: {instance.ai_allowed_phone}</span>}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(expanded === "ai" ? null : "ai")}>
            IA
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setExpanded(expanded === "settings" ? null : "settings")}>
            <Settings className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleReconfigureWebhook} disabled={reconfiguring} title="Reconfigurar webhook">
            {reconfiguring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {expanded === "ai" && (
        <div className="border-t px-3 py-3 space-y-2 bg-muted/20">
          <label className="text-xs font-medium text-muted-foreground">Número autorizado a falar com a IA</label>
          <p className="text-xs text-muted-foreground">
            Se preenchido, a IA <strong>só responderá</strong> a este número. Deixe vazio para permitir qualquer usuário cadastrado.
          </p>
          <div className="flex gap-2">
            <Input
              value={allowed}
              onChange={(e) => setAllowed(e.target.value)}
              placeholder="Ex: 5511988887777 (com DDI e DDD, só dígitos)"
            />
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {expanded === "settings" && (
        <div className="border-t px-3 py-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-card-foreground">Responder em grupos</p>
              <p className="text-xs text-muted-foreground">Se desativado, mensagens de grupos são ignoradas.</p>
            </div>
            <Switch checked={!groupsIgnore} onCheckedChange={(v) => setGroupsIgnore(!v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-card-foreground">Rejeitar chamadas</p>
              <p className="text-xs text-muted-foreground">Bloqueia chamadas recebidas no WhatsApp.</p>
            </div>
            <Switch checked={rejectCall} onCheckedChange={setRejectCall} />
          </div>
          {rejectCall && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem ao rejeitar chamada</label>
              <Input value={msgCall} onChange={(e) => setMsgCall(e.target.value)} placeholder="Não atendo chamadas. Mande mensagem." />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-card-foreground">Sempre online</p>
              <p className="text-xs text-muted-foreground">Mostra status "online" continuamente.</p>
            </div>
            <Switch checked={alwaysOnline} onCheckedChange={setAlwaysOnline} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-card-foreground">Marcar mensagens como lidas</p>
              <p className="text-xs text-muted-foreground">Mostra "visto" automaticamente para o remetente.</p>
            </div>
            <Switch checked={readMessages} onCheckedChange={setReadMessages} />
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Sincronizar com Evolution
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Notification Preferences Component ---
const NOTIFICATION_TYPES = [
  { key: "new_task", label: "Nova tarefa atribuída" },
  { key: "request_received", label: "Solicitação recebida" },
  { key: "request_accepted", label: "Solicitação aceita" },
  { key: "request_refused", label: "Solicitação recusada" },
  { key: "task_due_today", label: "Task com prazo hoje" },
  { key: "impediment_resolved", label: "Impedimento resolvido" },
  { key: "linked_card_created", label: "Card vinculado criado" },
] as const;

function formatPhone(value: string): string {
  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, "");
  
  // Se começar com 55 (Brasil)
  if (digits.startsWith("55") && digits.length > 2) {
    const rest = digits.slice(2);
    // DDD + número
    if (rest.length <= 2) {
      return `+55 (${rest}`;
    } else if (rest.length <= 7) {
      return `+55 (${rest.slice(0, 2)}) ${rest.slice(2)}`;
    } else {
      return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7, 11)}`;
    }
  }
  
  // Sem código do país - formato nacional
  if (digits.length <= 2) {
    return `(${digits}`;
  } else if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  } else {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
}

function ProfileSection({ profile, updateProfile }: { profile: any; updateProfile: any }) {
  const [editName, setEditName] = useState(profile?.name || "");
  const [editPhone, setEditPhone] = useState(profile?.phone || "");
  const [editSlackId, setEditSlackId] = useState(profile?.slack_user_id || "");
  const [saving, setSaving] = useState(false);

  // Sync state when profile data refreshes from server
  useEffect(() => {
    setEditName(profile?.name || "");
    setEditPhone(profile?.phone ? formatPhone(profile.phone) : "");
    setEditSlackId(profile?.slack_user_id || "");
  }, [profile?.name, profile?.phone, profile?.slack_user_id]);

  const cleanedPhone = editPhone.replace(/[^\d+]/g, "");
  const cleanedSlackId = editSlackId.trim();
  const hasChanges =
    editName !== (profile?.name || "") ||
    cleanedPhone !== (profile?.phone || "") ||
    cleanedSlackId !== (profile?.slack_user_id || "");

  const handleSave = async () => {
    if (!profile || !editName.trim()) return;
    setSaving(true);
    updateProfile.mutate(
      {
        id: profile.id,
        name: editName.trim(),
        phone: cleanedPhone || null,
        slack_user_id: cleanedSlackId || null,
      },
      {
        onSuccess: () => { toast.success("Perfil atualizado!"); setSaving(false); },
        onError: () => { toast.error("Erro ao salvar"); setSaving(false); },
      }
    );
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw.length < editPhone.length) {
      setEditPhone(raw);
      return;
    }
    setEditPhone(formatPhone(raw));
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h3 className="font-heading font-semibold text-card-foreground">Dados pessoais</h3>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Nome</label>
        <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Seu nome" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input value={profile?.email || ""} disabled className="bg-muted" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Telefone</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="(11) 99999-9999"
            value={editPhone}
            onChange={handlePhoneChange}
            className="pl-9"
            maxLength={16}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Slack User ID</label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="U01ABCD2EFG"
            value={editSlackId}
            onChange={(e) => setEditSlackId(e.target.value)}
            className="pl-9"
            maxLength={32}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Necessário para usar o <code className="text-foreground">/taskai</code> no Slack. No Slack, abra seu perfil → menu (...) → "Copiar ID do membro".
        </p>
      </div>
      {hasChanges && (
        <Button onClick={handleSave} disabled={saving || !editName.trim()}>
          {saving ? "Salvando..." : "Salvar alteracoes"}
        </Button>
      )}
    </div>
  );
}

type ChannelPref = "app" | "email" | "whatsapp" | "both" | "all";

function NotificationPreferences({ profile, updateProfile }: { profile: any; updateProfile: any }) {
  const prefs: Record<string, string> = profile?.notification_preferences || {};

  const handleChange = (type: string, value: string) => {
    const updated = { ...prefs, [type]: value };
    updateProfile.mutate({ id: profile.id, notification_preferences: updated });
  };

  // Default para nova_task é "email" já que é o mais útil
  const getDefault = (key: string) => key === "new_task" ? "email" : "app";

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div>
        <h3 className="font-heading font-semibold text-card-foreground">Preferências de notificação</h3>
        <p className="text-xs text-muted-foreground mt-1">Escolha onde receber cada tipo de notificação.</p>
      </div>

      {/* Digest diário */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-card-foreground">Resumo diário</p>
            <p className="text-xs text-muted-foreground">Atrasadas · Para hoje · Amanhã — enviado às 8h</p>
          </div>
          <Select value={prefs["daily_digest"] || "email"} onValueChange={(v) => handleChange("daily_digest", v)}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="app">Só no app</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="both">Email + WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notificações individuais */}
      <div className="space-y-2">
        {NOTIFICATION_TYPES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="text-sm text-card-foreground">{label}</span>
            <Select value={prefs[key] || getDefault(key)} onValueChange={(v) => handleChange(key, v as ChannelPref)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="app">Só no app</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="both">App + WhatsApp</SelectItem>
                <SelectItem value="all">Todos (app + email + WA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Email Integration Component ---
function EmailIntegration() {
  const { profile } = useAuth();
  const workspaceId = profile?.workspace_id;
  const [gmailUser, setGmailUser] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSave = async () => {
    if (!gmailUser.trim() || !appPassword.trim()) {
      toast.error("Preencha o email e a senha de app");
      return;
    }
    if (!workspaceId) {
      toast.error("Workspace não encontrado");
      return;
    }
    setSaving(true);
    try {
      // Salva os dois secrets no vault via store-api-key
      const { data: d1, error: e1 } = await supabase.functions.invoke("store-api-key", {
        body: { service_name: "gmail_user", secret_value: gmailUser.trim(), workspace_id: workspaceId, label: "Gmail remetente" },
      });
      const { data: d2, error: e2 } = await supabase.functions.invoke("store-api-key", {
        body: { service_name: "gmail_app_password", secret_value: appPassword.trim(), workspace_id: workspaceId, label: "Gmail App Password" },
      });
      if (e1 || e2 || !d1?.success || !d2?.success) throw new Error("Erro ao salvar no vault");
      toast.success("Credenciais de email salvas! Reinicie a Edge Function notify-daily no dashboard do Supabase.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("notify-daily", { body: {} });
      if (error) throw error;
      setTestResult({ ok: true, message: `Digest disparado com sucesso! Emails enviados: ${data?.emailsSent ?? 0}` });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || "Erro ao disparar" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuração SMTP */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div>
          <h3 className="font-heading font-semibold text-card-foreground">Remetente de email (Gmail)</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure uma conta Gmail para enviar notificações. Use uma{" "}
            <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Senha de App
            </a>{" "}
            (não a senha normal da conta).
          </p>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
          <p className="font-medium text-card-foreground">Como gerar a Senha de App:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Acesse <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary underline">myaccount.google.com/security</a></li>
            <li>Ative a verificação em duas etapas (se ainda não estiver ativa)</li>
            <li>Pesquise "Senhas de app" na barra de pesquisa</li>
            <li>Crie uma senha para "Outro (nome personalizado)" → ex: <strong>Grazing Tasks</strong></li>
            <li>Copie a senha de 16 caracteres gerada</li>
          </ol>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email remetente (Gmail)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="seuemail@gmail.com"
                value={gmailUser}
                onChange={(e) => setGmailUser(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Senha de App (16 caracteres)</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showPass ? "text" : "password"}
                placeholder="xxxx xxxx xxxx xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                className="pl-9 pr-20 font-mono text-sm"
                maxLength={19}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showPass ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !gmailUser.trim() || !appPassword.trim()} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar credenciais"}
          </Button>
        </div>
      </div>

      {/* Testar e disparar manualmente */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h3 className="font-heading font-semibold text-card-foreground">Digest diário</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enviado automaticamente todos os dias úteis às <strong>8h (BRT)</strong> com tarefas atrasadas, de hoje e de amanhã.
            Use o botão abaixo para testar agora.
          </p>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${testResult.ok ? "bg-primary/10 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
            {testResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {testResult.message}
          </div>
        )}

        <Button variant="outline" onClick={handleTest} className="gap-2">
          <Mail className="h-4 w-4" /> Disparar digest agora
        </Button>
      </div>
    </div>
  );
}

// --- Slack Integration Component ---
function SlackIntegration({ workspaceId }: { workspaceId: string }) {
  const [signingSecret, setSigningSecret] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
  const slackEndpoint = projectId
    ? `https://${projectId}.supabase.co/functions/v1/slack-command`
    : "";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("slack_settings")
        .select("vault_signing_secret_id, is_enabled")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (data) {
        setHasExisting(true);
        setIsEnabled(data.is_enabled !== false);
        // We never display the secret value — only whether it's configured
        setSigningSecret(data.vault_signing_secret_id ? "••••••••••••••••" : "");
      }
      setLoading(false);
    };
    if (workspaceId) load();
  }, [workspaceId]);

  const handleSave = async () => {
    if (!signingSecret.trim() || signingSecret.startsWith("•")) {
      toast.error("Informe o Signing Secret do seu app Slack");
      return;
    }
    setSaving(true);

    // 1. Store in vault via edge function
    const { data: stored, error: storeErr } = await supabase.functions.invoke("store-api-key", {
      body: { service_name: "slack_signing", secret_value: signingSecret.trim(), workspace_id: workspaceId, label: "Slack Signing Secret" },
    });
    if (storeErr || !stored?.success) {
      toast.error("Erro ao salvar no vault: " + (storeErr?.message || "desconhecido"));
      setSaving(false);
      return;
    }

    // 2. Upsert slack_settings with vault reference
    const payload = {
      workspace_id: workspaceId,
      vault_signing_secret_id: stored.vault_secret_id,
      is_enabled: isEnabled,
    };
    const { error } = hasExisting
      ? await supabase.from("slack_settings").update(payload).eq("workspace_id", workspaceId)
      : await supabase.from("slack_settings").insert(payload);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração do Slack salva!");
      setHasExisting(true);
      setSigningSecret("••••••••••••••••");
    }
    setSaving(false);
  };

  const handleToggle = async (next: boolean) => {
    setIsEnabled(next);
    if (hasExisting) {
      await supabase.from("slack_settings").update({ is_enabled: next }).eq("workspace_id", workspaceId);
      toast.success(next ? "Slack ativado" : "Slack desativado");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading font-semibold text-card-foreground">Integração com Slack</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permita que seu time consulte tasks usando <code className="text-foreground">/taskai</code> no Slack.
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={!hasExisting} />
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
          <p className="font-medium text-card-foreground">Como configurar:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Acesse <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">api.slack.com/apps</a> e crie um app "From scratch".</li>
            <li>Em <strong>Slash Commands</strong>, crie <code className="text-foreground">/taskai</code> com Request URL:</li>
          </ol>
          <div className="rounded bg-background border px-3 py-2 font-mono text-xs break-all">
            {slackEndpoint || "Endpoint indisponível — VITE_SUPABASE_PROJECT_ID ausente"}
          </div>
          <ol start={3} className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Em <strong>Basic Information → App Credentials</strong>, copie o <strong>Signing Secret</strong> e cole abaixo.</li>
            <li>Instale o app no workspace do Slack.</li>
            <li>Cada usuário precisa cadastrar o próprio Slack User ID na aba <strong>Perfil</strong>.</li>
          </ol>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Signing Secret</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type={showSecret ? "text" : "password"}
              placeholder="Ex.: 8f742b1c3d9e4a7bb2e19c3f4d5a6e7b"
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
              className="pl-9 pr-20 font-mono text-xs"
              maxLength={128}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showSecret ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !signingSecret.trim()}>
          {saving ? "Salvando..." : hasExisting ? "Atualizar" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function ConfiguracoesPage() {
  const { profile, user } = useAuth();
  const { data: collections } = useCollections();
  const { data: allColumns } = useAllColumns();
  const { data: connections } = useColumnConnections();
  const { data: sectors } = useSectors();
  const { data: profiles } = useProfiles();
  const { data: userRoles } = useUserRoles();
  const { data: userSectors } = useUserSectors();
  const createCollection = useCreateCollection();
  const createConnection = useCreateColumnConnection();
  const deleteConnection = useDeleteColumnConnection();
  const createSector = useCreateSector();
  const deleteSector = useDeleteSector();
  const updateProfile = useUpdateProfile();
  const addUserSector = useAddUserSector();
  const removeUserSector = useRemoveUserSector();
  const { data: teams } = useTeams();
  const { data: collectionTeamsData } = useCollectionTeams();
  const { data: collectionUsersData } = useCollectionUsers();
  const addCollectionTeam = useAddCollectionTeam();
  const removeCollectionTeam = useRemoveCollectionTeam();
  const addCollectionUser = useAddCollectionUser();
  const removeCollectionUser = useRemoveCollectionUser();

  const qc = useQueryClient();
  const [newColName, setNewColName] = useState("");
  const [newSectorName, setNewSectorName] = useState("");
  const [sourceCol, setSourceCol] = useState("");
  const [targetCol, setTargetCol] = useState("");

  const currentRole = userRoles?.find(r => r.user_id === user?.id)?.role || "usuario";
  const isAdmin = currentRole === "admin";
  const isManager = currentRole === "admin" || currentRole === "gestor";

  const handleCreateCollection = () => {
    if (!newColName.trim()) return;
    createCollection.mutate(newColName.trim());
    setNewColName("");
    toast.success("Coleção criada!");
  };

  const handleCreateSector = () => {
    if (!newSectorName.trim()) return;
    createSector.mutate(newSectorName.trim());
    setNewSectorName("");
    toast.success("Setor criado!");
  };

  const handleCreateConnection = () => {
    if (!sourceCol || !targetCol || sourceCol === targetCol) {
      toast.error("Selecione colunas diferentes");
      return;
    }
    const srcCol = allColumns?.find(c => c.id === sourceCol);
    const tgtCol = allColumns?.find(c => c.id === targetCol);
    if (srcCol?.collection_id === tgtCol?.collection_id) {
      toast.error("As colunas devem ser de coleções diferentes");
      return;
    }
    createConnection.mutate({ source_column_id: sourceCol, target_column_id: targetCol });
    setSourceCol("");
    setTargetCol("");
    toast.success("Conexão criada!");
  };

  const getColLabel = (colId: string) => {
    const col = allColumns?.find(c => c.id === colId);
    if (!col) return colId;
    return `${(col as any).collections?.name || "?"} → ${col.name}`;
  };

  const getUserRole = (userId: string) => {
    const role = userRoles?.find(r => r.user_id === userId);
    return role?.role || "usuario";
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Configurações</h1>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new Event("taskai:open-onboarding"))}
              className="gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" /> Reabrir Wizard
            </Button>
          )}
        </div>

        <Tabs defaultValue="perfil">
          <TabsList className="flex-wrap h-auto gap-1">
            {isManager && <TabsTrigger value="colecoes">Coleções</TabsTrigger>}
            {isManager && <TabsTrigger value="conexoes"><Link2 className="h-3.5 w-3.5 mr-1" /> Conexões</TabsTrigger>}
            {isAdmin && <TabsTrigger value="setores"><Building2 className="h-3.5 w-3.5 mr-1" /> Setores</TabsTrigger>}
            {isAdmin && <TabsTrigger value="usuarios"><Users className="h-3.5 w-3.5 mr-1" /> Usuários</TabsTrigger>}
            {isAdmin && <TabsTrigger value="acesso"><Shield className="h-3.5 w-3.5 mr-1" /> Acesso</TabsTrigger>}
            {isAdmin && <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 mr-1" /> Email</TabsTrigger>}
            {isAdmin && <TabsTrigger value="whatsapp"><MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp</TabsTrigger>}
            {isAdmin && <TabsTrigger value="slack"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Slack</TabsTrigger>}
            {isManager && <TabsTrigger value="agenda"><Clock className="h-3.5 w-3.5 mr-1" /> Agenda</TabsTrigger>}
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
          </TabsList>

          {/* Coleções */}
          <TabsContent value="colecoes" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Nome da nova coleção" value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()} />
              <Button onClick={handleCreateCollection}><Plus className="h-4 w-4 mr-1" /> Criar</Button>
            </div>
            <div className="space-y-2">
              {collections?.filter(c => !c.is_archived).map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="h-7 w-7 rounded-full border-2 border-dashed shrink-0 hover:scale-110 transition-transform"
                        style={{ backgroundColor: (c as any).color || 'transparent' }}
                        title="Editar cor"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <ColorPicker
                        value={(c as any).color || null}
                        onChange={async (color) => {
                          await supabase.from('collections').update({ color }).eq('id', c.id);
                          qc.invalidateQueries({ queryKey: ['collections'] });
                          toast.success('Cor atualizada!');
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-sm font-medium text-card-foreground">{c.name}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Conexões */}
          <TabsContent value="conexoes" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte colunas de coleções diferentes. Quando uma task chegar na coluna de origem, um card vinculado será criado automaticamente na coluna de destino.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={sourceCol} onValueChange={setSourceCol}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Coluna de origem" /></SelectTrigger>
                <SelectContent>
                  {allColumns?.map(col => (
                    <SelectItem key={col.id} value={col.id}>{(col as any).collections?.name} → {col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground self-center">→</span>
              <Select value={targetCol} onValueChange={setTargetCol}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Coluna de destino" /></SelectTrigger>
                <SelectContent>
                  {allColumns?.map(col => (
                    <SelectItem key={col.id} value={col.id}>{(col as any).collections?.name} → {col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreateConnection} size="sm"><Plus className="h-4 w-4 mr-1" /> Conectar</Button>
            </div>
            <div className="space-y-2">
              {connections?.map(conn => (
                <div key={conn.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2 text-sm text-card-foreground">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span>{getColLabel(conn.source_column_id)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{getColLabel(conn.target_column_id)}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteConnection.mutate(conn.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {(!connections || connections.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conexão configurada.</p>
              )}
            </div>
          </TabsContent>

          {/* Setores */}
          <TabsContent value="setores" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Nome do setor" value={newSectorName} onChange={(e) => setNewSectorName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateSector()} />
              <Button onClick={handleCreateSector}><Plus className="h-4 w-4 mr-1" /> Criar</Button>
            </div>
            <div className="space-y-2">
              {sectors?.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <span className="text-sm font-medium text-card-foreground">{s.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { deleteSector.mutate(s.id); toast.success("Setor removido"); }}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {(!sectors || sectors.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum setor criado.</p>
              )}
            </div>
          </TabsContent>

          {/* Usuários */}
          <TabsContent value="usuarios" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Gerencie os membros do workspace.</p>
            <div className="space-y-2">
              {profiles?.map(p => {
                const pSectors = userSectors?.filter(us => us.user_id === p.user_id) || [];
                const pSectorIds = pSectors.map(us => us.sector_id);
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                        {p.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Multi-sector checkboxes */}
                      <div className="flex flex-wrap gap-2">
                        {sectors?.map(s => {
                          const isChecked = pSectorIds.includes(s.id);
                          return (
                            <label key={s.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    addUserSector.mutate({ user_id: p.user_id, sector_id: s.id });
                                  } else {
                                    removeUserSector.mutate({ user_id: p.user_id, sector_id: s.id });
                                  }
                                }}
                              />
                              <span className="text-card-foreground">{s.name}</span>
                            </label>
                          );
                        })}
                        {(!sectors || sectors.length === 0) && (
                          <span className="text-xs text-muted-foreground">Sem setores</span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded capitalize">{getUserRole(p.user_id)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Acesso a Coleções */}
          <TabsContent value="acesso" className="mt-4 space-y-6">
            <p className="text-sm text-muted-foreground">
              Configure quais equipes e usuários têm acesso a cada coleção. Coleções sem regras de acesso ficam visíveis para todos.
            </p>
            {collections?.filter(c => !c.is_archived).map(col => {
              const colTeams = collectionTeamsData?.filter(ct => ct.collection_id === col.id) || [];
              const colUsers = collectionUsersData?.filter(cu => cu.collection_id === col.id) || [];
              return (
                <div key={col.id} className="rounded-xl border bg-card p-4 space-y-4">
                  <h4 className="font-semibold text-card-foreground">{col.name}</h4>
                  
                  {/* Teams */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Equipes com acesso</label>
                    <div className="flex flex-wrap gap-1.5">
                      {colTeams.map(ct => {
                        const team = teams?.find(t => t.id === ct.team_id);
                        return (
                          <span key={ct.id} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs">
                            {team?.name || ct.team_id}
                            <button onClick={() => removeCollectionTeam.mutate(ct.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                    {teams && teams.filter(t => !colTeams.some(ct => ct.team_id === t.id)).length > 0 && (
                      <Select onValueChange={(tid) => addCollectionTeam.mutate({ collectionId: col.id, teamId: tid })}>
                        <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="+ Adicionar equipe" /></SelectTrigger>
                        <SelectContent>
                          {teams.filter(t => !colTeams.some(ct => ct.team_id === t.id)).map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Users */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuários individuais</label>
                    <div className="flex flex-wrap gap-1.5">
                      {colUsers.map(cu => {
                        const p = profiles?.find(pr => pr.user_id === cu.user_id);
                        return (
                          <span key={cu.id} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs">
                            {p?.name || cu.user_id}
                            <button onClick={() => removeCollectionUser.mutate(cu.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                    {profiles && profiles.filter(p => !colUsers.some(cu => cu.user_id === p.user_id)).length > 0 && (
                      <Select onValueChange={(uid) => addCollectionUser.mutate({ collectionId: col.id, userId: uid })}>
                        <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="+ Adicionar usuário" /></SelectTrigger>
                        <SelectContent>
                          {profiles.filter(p => !colUsers.some(cu => cu.user_id === p.user_id)).map(p => (
                            <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {colTeams.length === 0 && colUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Sem restrições — todos os membros podem ver esta coleção.</p>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Email */}
          <TabsContent value="email" className="mt-4">
            <EmailIntegration />
          </TabsContent>

          {/* WhatsApp */}
          <TabsContent value="whatsapp" className="mt-4">
            <WhatsAppIntegration profile={profile} />
          </TabsContent>

          {/* Slack */}
          <TabsContent value="slack" className="mt-4">
            {profile?.workspace_id && <SlackIntegration workspaceId={profile.workspace_id} />}
          </TabsContent>

          {/* Agenda de Trabalho */}
          <TabsContent value="agenda" className="mt-4">
            <WorkScheduleSettings />
          </TabsContent>

          {/* Perfil & Notificações */}
          <TabsContent value="perfil" className="mt-4 space-y-6">
            <ProfileSection profile={profiles?.find(p => p.user_id === user?.id) || profile} updateProfile={updateProfile} />
            <NotificationPreferences profile={profiles?.find(p => p.user_id === user?.id) || profile} updateProfile={updateProfile} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
