import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readEvolutionCredentials } from "../_shared/vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  instance_id: string;
  groups_ignore?: boolean;
  reject_call?: boolean;
  msg_call?: string;
  always_online?: boolean;
  read_messages?: boolean;
  webhook_enabled?: boolean;
  reconfigure_webhook?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = (await req.json()) as Body;
    const { instance_id } = body;

    if (!instance_id) {
      return new Response(
        JSON.stringify({ success: false, error: "instance_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name")
      .eq("id", instance_id)
      .maybeSingle();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ success: false, error: "Instância não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const creds = await readEvolutionCredentials(supabase, instance_id);
    if (!creds) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais da instância não encontradas no vault" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = creds.api_url.replace(/\/$/, "").replace(/\/manager$/, "");
    const results: Record<string, unknown> = {};

    const hasSettings =
      body.groups_ignore !== undefined ||
      body.reject_call !== undefined ||
      body.always_online !== undefined ||
      body.read_messages !== undefined;

    if (hasSettings) {
      const payload = {
        rejectCall: body.reject_call ?? false,
        msgCall: body.reject_call ? (body.msg_call ?? "") : "",
        groupsIgnore: body.groups_ignore ?? true,
        alwaysOnline: body.always_online ?? false,
        readMessages: body.read_messages ?? false,
        readStatus: false,
        syncFullHistory: false,
      };

      console.log(`[update-evolution-settings] POST /settings/set/${instance.instance_name}`, payload);
      const res = await fetch(`${baseUrl}/settings/set/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: creds.api_key },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log(`[update-evolution-settings] settings (${res.status}):`, text.substring(0, 300));
      results.settings = { status: res.status, ok: res.ok };

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Evolution API /settings respondeu ${res.status}`,
            details: text.substring(0, 300),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (body.webhook_enabled !== undefined || body.reconfigure_webhook) {
      const enabled = body.webhook_enabled !== false;
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp`;
      const webhookPayload = {
        webhook: {
          enabled,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        },
      };

      console.log(`[update-evolution-settings] POST /webhook/set/${instance.instance_name}`, { enabled, url: webhookUrl });
      const webhookRes = await fetch(`${baseUrl}/webhook/set/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: creds.api_key },
        body: JSON.stringify(webhookPayload),
      });
      const webhookText = await webhookRes.text();
      console.log(`[update-evolution-settings] webhook (${webhookRes.status}):`, webhookText.substring(0, 300));
      results.webhook = { status: webhookRes.status, ok: webhookRes.ok, url: webhookUrl };

      if (!webhookRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Evolution API /webhook respondeu ${webhookRes.status}`,
            details: webhookText.substring(0, 300),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[update-evolution-settings] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
