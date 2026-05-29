import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { storeEvolutionCredentials } from "../_shared/vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { api_url, api_key, instance_name, name, workspace_id } = await req.json();

    if (!api_url || !api_key || !instance_name || !name || !workspace_id) {
      return new Response(JSON.stringify({ success: false, error: "Campos obrigatórios: api_url, api_key, instance_name, name, workspace_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = api_url.replace(/\/$/, "").replace(/\/manager$/, "");

    console.log(`[create-evolution-instance] Creating: ${instance_name} at ${baseUrl}`);
    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: api_key },
      body: JSON.stringify({
        instanceName: instance_name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        groupsIgnore: true,
      }),
    });

    const createText = await createRes.text();
    console.log(`[create-evolution-instance] Response (${createRes.status}): ${createText.substring(0, 500)}`);

    let createData: any = {};
    try { createData = JSON.parse(createText); } catch {}

    if (!createRes.ok && createRes.status !== 200 && createRes.status !== 201) {
      return new Response(JSON.stringify({ success: false, error: `Erro Evolution API: ${createRes.status}`, details: createText }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let qrCode: string | null = createData?.qrcode?.base64 || createData?.hash?.qrcode || null;

    if (!qrCode) {
      await new Promise(r => setTimeout(r, 1500));
      const qrRes = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        headers: { apikey: api_key },
      });
      if (qrRes.ok) {
        try {
          const qrData = await qrRes.json();
          qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null;
        } catch {}
      }
    }

    const { data: instance, error: insertError } = await supabase
      .from("whatsapp_instances")
      .insert({
        workspace_id,
        name,
        instance_name,
        status: qrCode ? "qr_required" : "disconnected",
        qr_code: qrCode,
        is_default: true,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[create-evolution-instance] DB error:", insertError);
      return new Response(JSON.stringify({ success: false, error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store secrets in Vault
    let vaultRefs: { vault_url_id: string; vault_key_id: string };
    try {
      vaultRefs = await storeEvolutionCredentials(supabase, instance.id, api_url, api_key);
    } catch (e) {
      console.error("[create-evolution-instance] vault error:", e);
      await supabase.from("whatsapp_instances").delete().eq("id", instance.id);
      return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Vault error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: secretsError } = await supabase
      .from("whatsapp_instance_secrets")
      .insert({
        instance_id: instance.id,
        vault_url_id: vaultRefs.vault_url_id,
        vault_key_id: vaultRefs.vault_key_id,
      });

    if (secretsError) {
      await supabase.from("whatsapp_instances").delete().eq("id", instance.id);
      return new Response(JSON.stringify({ success: false, error: secretsError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp`;
    try {
      await fetch(`${baseUrl}/webhook/set/${instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: api_key },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
        }),
      });
    } catch (e) {
      console.warn("[create-evolution-instance] Webhook setup failed (non-fatal):", e);
    }

    return new Response(JSON.stringify({
      success: true,
      instance_id: instance.id,
      qr_code: qrCode,
      status: instance.status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("[create-evolution-instance] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
