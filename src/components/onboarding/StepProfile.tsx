import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  onSaved: () => void;
  registerSave: (fn: () => Promise<boolean>) => void;
}

export function StepProfile({ onSaved, registerSave }: Props) {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");

  useEffect(() => {
    setName(profile?.name || "");
    setPhone(profile?.phone || "");
  }, [profile?.name, profile?.phone]);

  useEffect(() => {
    registerSave(async () => {
      if (!user) return false;
      if (!name.trim()) {
        toast.error("Informe seu nome");
        return false;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), phone: phone.trim() || null })
        .eq("user_id", user.id);
      if (error) {
        toast.error("Erro ao salvar perfil");
        return false;
      }
      onSaved();
      return true;
    });
  }, [name, phone, user, registerSave, onSaved]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold">Seu perfil</h2>
          <p className="text-sm text-muted-foreground">Como devemos te chamar?</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome completo *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder="Seu nome" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Telefone (opcional)</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" placeholder="+55 11 99999-9999" />
          <p className="text-xs text-muted-foreground">Usado para receber notificações por WhatsApp.</p>
        </div>
      </div>
    </div>
  );
}
