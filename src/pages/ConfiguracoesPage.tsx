import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function ConfiguracoesPage() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");

  const save = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ name, phone }).eq("id", profile.id);
    if (error) toast({ description: error.message, variant: "destructive" });
    else toast({ description: "Perfil atualizado" });
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <section className="space-y-4 border rounded-lg p-6">
          <h2 className="font-medium">Perfil</h2>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={profile?.email || ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={phone || ""} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={save}>Salvar</Button>
        </section>
      </div>
    </AppLayout>
  );
}
