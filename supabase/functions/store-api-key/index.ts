// Stores an API key in Supabase Vault, scoped to the user's workspace.
// Validates JWT, then calls the SECURITY DEFINER RPC vault_store_workspace_secret.
// Never returns the secret value back to the client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Validate caller JWT with anon client (carries user context)
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Use service-role client to call the SECURITY DEFINER RPC.
  //    The RPC itself enforces role + workspace match using the JWT claims forwarded below.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
    // Auth header forwarded so auth.uid() / has_role() inside the RPC see the real caller.
  );

  try {
    const { service_name, secret_value, label, workspace_id } = await req.json();

    if (!service_name || typeof service_name !== "string" || service_name.length > 64) {
      return new Response(JSON.stringify({ error: "service_name inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!secret_value || typeof secret_value !== "string") {
      return new Response(JSON.stringify({ error: "secret_value obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!workspace_id || typeof workspace_id !== "string") {
      return new Response(JSON.stringify({ error: "workspace_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("vault_store_workspace_secret", {
      _workspace_id: workspace_id,
      _service_name: service_name,
      _secret_value: secret_value,
      _label: label ?? null,
    });

    if (error) {
      console.error("[store-api-key] rpc error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, vault_secret_id: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
