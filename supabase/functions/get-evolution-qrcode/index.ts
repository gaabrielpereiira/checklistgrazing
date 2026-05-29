import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readEvolutionCredentials } from "../_shared/vault.ts";

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

    const { data: instance, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (error || !instance) {
      return new Response(JSON.stringify({ success: false, error: "Instância não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await readEvolutionCredentials(supabase, instance_id);
    if (!creds) {
      return new Response(JSON.stringify({ success: false, error: "Credenciais não encontradas no vault" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = creds.api_url.replace(/\/$/, "");
    const instanceName = instance.instance_name;

    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: creds.api_key },
    });

    let currentState = "disconnected";
    if (stateRes.ok) {
      try {
        const stateData = await stateRes.json();
        currentState = stateData?.state || stateData?.instance?.state || "disconnected";
      } catch {}
    }

    console.log(`[get-evolution-qrcode] ${instanceName} state: ${currentState}`);

    if (currentState === "open") {
      await supabase.from("whatsapp_instances").update({ status: "connected", qr_code: null, updated_at: new Date().toISOString() }).eq("id", instance_id);
      return new Response(JSON.stringify({ success: true, connected: true, status: "connected", qr_code: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qrRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: creds.api_key },
    });

    let qrCode: string | null = null;
    let connected = false;

    if (qrRes.ok) {
      try {
        const qrData = await qrRes.json();
        qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null;
        connected = qrData?.state === "open" || qrData?.instance?.state === "open";
      } catch {}
    }

    if (qrCode || connected) {
      await supabase.from("whatsapp_instances").update({
        status: connected ? "connected" : "qr_required",
        qr_code: connected ? null : qrCode,
        updated_at: new Date().toISOString(),
      }).eq("id", instance_id);
    }

    return new Response(JSON.stringify({
      success: true, connected,
      status: connected ? "connected" : (qrCode ? "qr_required" : "disconnected"),
      qr_code: qrCode,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("[get-evolution-qrcode] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
