import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function StepNotifications() {
  const { user, profile } = useAuth();
  const [whats, setWhats] = useState(profile?.whatsapp_notifications || false);

  useEffect(() => {
    setWhats(profile?.whatsapp_notifications || false);
  }, [profile?.whatsapp_notifications]);

  const toggle = async (next: boolean) => {
    setWhats(next);
    if (!user) return;
    await supabase.from("profiles").update({ whatsapp_notifications: next }).eq("user_id", user.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Bell className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Notificações</h2>
          <p className="text-sm text-muted-foreground">Como você quer ser avisado?</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Notificações no app</p>
            <p className="text-xs text-muted-foreground">Sininho no topo (sempre ligado)</p>
          </div>
          <Switch checked disabled />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Notificações por WhatsApp</p>
            <p className="text-xs text-muted-foreground">Requer telefone preenchido e instância conectada</p>
          </div>
          <Switch checked={whats} onCheckedChange={toggle} />
        </div>
      </div>
    </div>
  );
}
