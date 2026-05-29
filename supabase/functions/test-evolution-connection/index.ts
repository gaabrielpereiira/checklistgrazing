import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { api_url, api_key } = await req.json();
    if (!api_url || !api_key) {
      return new Response(JSON.stringify({ success: false, error: "URL e API Key obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = api_url.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { apikey: api_key },
    });

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, message: "Conexão estabelecida com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Falha na conexão: HTTP ${res.status}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro de conexão" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
