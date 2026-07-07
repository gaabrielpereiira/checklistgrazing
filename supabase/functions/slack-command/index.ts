// Slack slash command — read-only AI chat for Alexandre.
// Validates Slack signature using signing_secret stored in Supabase Vault (referenced via slack_settings.vault_signing_secret_id),
// maps Slack user_id → profile (via slack_user_id column), and runs the shared chat turn.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runChatTurn, type ChatHistoryMsg } from "../_shared/chat-core.ts";
import { readVaultSecret } from "../_shared/vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySlackSignature(
  body: string,
  timestamp: string | null,
  signature: string | null,
  signingSecret: string,
): Promise<boolean> {
  if (!signature || !timestamp || !signingSecret) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const digest = `v0=${Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;

  if (signature.length !== digest.length) return false;
  const a = encoder.encode(signature);
  const b = encoder.encode(digest);
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

function sanitizeForSlack(input: string): string {
  // Slack mrkdwn uses *bold* (single asterisks) and _italic_, no headings, no triple-backtick codeblocks needed.
  return input
    .replace(/\*\*(.*?)\*\*/g, "*$1*")
    .replace(/__(.*?)__/g, "*$1*")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadSlackHistory(
  supabase: any,
  userId: string,
  workspaceId: string,
  limit = 10,
): Promise<ChatHistoryMsg[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, metadata, created_at")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    console.warn("[slack] history load error:", error.message);
    return [];
  }

  const slackMsgs = (data || []).filter((m: any) => m?.metadata?.channel === "slack");
  return slackMsgs
    .reverse()
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({ role: m.role, content: m.content }))
    .slice(-limit);
}

async function saveChatMessage(
  supabase: any,
  userId: string,
  workspaceId: string,
  role: "user" | "assistant",
  content: string,
) {
  const { error } = await supabase.from("chat_messages").insert({
    user_id: userId,
    workspace_id: workspaceId,
    role,
    content,
    metadata: { channel: "slack" },
  });
  if (error) console.warn("[slack] save message error:", error.message);
}

async function processCommand(
  responseUrl: string,
  supabase: any,
  apiKey: string,
  slackUserId: string,
  slackWorkspaceId: string,
  text: string,
) {
  const sendResponse = async (body: Record<string, any>) => {
    try {
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("[slack] response_url post error:", e);
    }
  };

  // Map Slack user → app profile
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, workspace_id, name, slack_user_id")
    .eq("slack_user_id", slackUserId)
    .limit(1);

  if (profErr) console.warn("[slack] profile lookup error:", profErr.message);
  const profile = profiles?.[0];

  if (!profile) {
    await sendResponse({
      response_type: "ephemeral",
      text: `❌ Seu Slack User ID (\`${slackUserId}\`) não está vinculado a nenhuma conta no Alexandre. Acesse Configurações → Perfil no app e cole esse ID no campo "Slack User ID".`,
    });
    return;
  }

  // Make sure the workspace has Slack enabled (defensive)
  const { data: settings } = await supabase
    .from("slack_settings")
    .select("is_enabled, workspace_id")
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();

  if (settings && settings.is_enabled === false) {
    await sendResponse({
      response_type: "ephemeral",
      text: "⚠️ A integração com Slack está desativada para este workspace.",
    });
    return;
  }

  const history = await loadSlackHistory(supabase, profile.user_id, profile.workspace_id, 10);

  let replyText: string;
  try {
    replyText = await runChatTurn({
      supabase,
      apiKey,
      userId: profile.user_id,
      userMessage: text,
      history,
    });
  } catch (e) {
    console.error("[slack] runChatTurn error:", e);
    replyText = "Desculpe, tive um problema para processar sua mensagem agora. Tente de novo em instantes.";
  }

  const formatted = sanitizeForSlack(replyText);

  await saveChatMessage(supabase, profile.user_id, profile.workspace_id, "user", text);
  await saveChatMessage(supabase, profile.user_id, profile.workspace_id, "assistant", formatted);

  await sendResponse({
    response_type: "ephemeral",
    text: formatted,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const body = await req.text();
  const params = new URLSearchParams(body);

  const slackUserId = params.get("user_id") || "";
  const slackTeamId = params.get("team_id") || "";
  const commandText = (params.get("text") || "").trim();
  const responseUrl = params.get("response_url") || "";

  // Find any slack_settings row whose signing_secret validates the signature.
  // Signing secrets are stored in Supabase Vault — we read them via readVaultSecret.
  // (We can't trust slackTeamId to map to a workspace before validating the signature,
  //  so we try all configured signing_secrets — typically one per workspace.)
  const { data: allSettings } = await supabase
    .from("slack_settings")
    .select("workspace_id, vault_signing_secret_id, is_enabled")
    .not("vault_signing_secret_id", "is", null);

  const slackTimestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");

  let validWorkspaceId: string | null = null;
  for (const s of allSettings || []) {
    const signingSecret = await readVaultSecret(supabase, s.vault_signing_secret_id);
    if (!signingSecret) continue;
    const ok = await verifySlackSignature(body, slackTimestamp, slackSignature, signingSecret);
    if (ok) {
      validWorkspaceId = s.workspace_id;
      break;
    }
  }

  if (!validWorkspaceId) {
    console.warn("[slack] invalid signature or no signing_secret matches", { slackTeamId });
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ response_type: "ephemeral", text: "❌ AI key não configurada no servidor." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!commandText) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "🤖 *Alexandre no Slack*\nUse: `/alexandre sua pergunta`\n\nExemplos:\n• `/alexandre quais minhas tasks de hoje?`\n• `/alexandre o que tenho pra amanhã?`\n• `/alexandre tasks da coleção Marketing`",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!responseUrl) {
    return new Response(
      JSON.stringify({ response_type: "ephemeral", text: "❌ response_url ausente." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Background processing — Slack requires ack within 3s.
  processCommand(responseUrl, supabase, LOVABLE_API_KEY, slackUserId, slackTeamId, commandText).catch(
    (err) => console.error("[slack] background error:", err),
  );

  return new Response(
    JSON.stringify({ response_type: "ephemeral", text: "⏳ Consultando Alexandre..." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
