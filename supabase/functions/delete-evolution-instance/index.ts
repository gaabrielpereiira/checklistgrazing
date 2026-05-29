import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readEvolutionCredentials, deleteVaultSecrets } from "../_shared/vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { instance_id } = await req.json();
    if (!instance_id) {
      return new Response(JSON.stringify({ success: false, error: "instance_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("id", instance_id)
      .single();

    const { data: secretRefs } = await supabase
      .from("whatsapp_instance_secrets")
      .select("vault_url_id, vault_key_id")
      .eq("instance_id", instance_id)
      .maybeSingle();

    const creds = await readEvolutionCredentials(supabase, instance_id);

    if (instance && creds) {
      try {
        await fetch(`${creds.api_url.replace(/\/$/, "")}/instance/delete/${instance.instance_name}`, {
          method: "DELETE",
          headers: { apikey: creds.api_key },
        });
      } catch (e) {
        console.warn("[delete-evolution-instance] Evolution delete failed:", e);
      }
    }

    // Remove secrets from vault
    if (secretRefs) {
      await deleteVaultSecrets(supabase, [secretRefs.vault_url_id, secretRefs.vault_key_id]);
    }

    // Delete from DB (cascade deletes secret refs row)
    await supabase.from("whatsapp_instances").delete().eq("id", instance_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
