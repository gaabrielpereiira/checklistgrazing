import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runChatTurn, type ChatHistoryMsg } from "../_shared/chat-core.ts";
import { readEvolutionCredentials } from "../_shared/vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Phone resolution helpers ----------

function resolveSenderPhone(message: any): {
  phone: string;
  remoteJid: string;
  remoteJidAlt: string;
  senderPn: string;
} {
  const remoteJid: string = message?.key?.remoteJid || "";
  const remoteJidAlt: string = message?.key?.remoteJidAlt || "";
  const senderPn: string = message?.senderPn || message?.key?.senderPn || "";

  let raw = remoteJid;
  if (remoteJid.endsWith("@lid")) {
    raw = remoteJidAlt || senderPn || remoteJid;
  }

  raw = raw
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@lid", "")
    .replace("@g.us", "");

  const phone = raw.replace(/\D/g, "");
  return { phone, remoteJid, remoteJidAlt, senderPn };
}

function phoneVariants(digits: string): string[] {
  const variants = new Set<string>();
  if (!digits) return [];
  variants.add(digits);

  let core = digits;
  if (core.startsWith("55") && core.length >= 12) core = core.slice(2);
  variants.add(core);
  variants.add("55" + core);

  if (core.length === 11 && core[2] === "9") {
    const without9 = core.slice(0, 2) + core.slice(3);
    variants.add(without9);
    variants.add("55" + without9);
  } else if (core.length === 10) {
    const with9 = core.slice(0, 2) + "9" + core.slice(2);
    variants.add(with9);
    variants.add("55" + with9);
  }

  return Array.from(variants).filter(Boolean);
}

// ---------- Markdown sanitizer (safety net) ----------

function sanitizeForWhatsApp(input: string): string {
  return input
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Conversation history (per WhatsApp user) ----------

async function loadWhatsAppHistory(
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
    console.warn("[whatsapp] history load error:", error.message);
    return [];
  }

  const whatsappMsgs = (data || []).filter((m: any) => m?.metadata?.channel === "whatsapp");
  return whatsappMsgs
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
    metadata: { channel: "whatsapp" },
  });
  if (error) console.warn("[whatsapp] save message error:", error.message);
}

// ---------- Main handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const body = await req.json();
    const event = body.event || body.data?.event;

    // ---- QR code update ----
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const instanceName = body.instance || body.data?.instance;
      const qrCode = body.data?.qrcode?.base64 || body.data?.qrcode?.code || body.qrcode?.base64 || null;
      if (instanceName) {
        await supabase.from("whatsapp_instances")
          .update({ qr_code: qrCode, status: "qrcode", updated_at: new Date().toISOString() })
          .eq("instance_name", instanceName);
        console.log(`[whatsapp] QR updated for ${instanceName}`);
      }
      return new Response("ok", { headers: corsHeaders });
    }

    // ---- Connection state update ----
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = body.data?.state || body.state;
      const instanceName = body.instance || body.data?.instance;
      if (instanceName && state) {
        const newStatus = state === "open" ? "connected" : "disconnected";
        await supabase.from("whatsapp_instances")
          .update({ status: newStatus, qr_code: null, updated_at: new Date().toISOString() })
          .eq("instance_name", instanceName);
        console.log(`[whatsapp] Instance ${instanceName} status → ${newStatus}`);
      }
      return new Response("ok", { headers: corsHeaders });
    }

    // ---- Incoming message ----
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT" || body.data?.message) {
      const msg = body.data || body.message ? (body.data || body) : null;
      if (!msg) return new Response("ok", { headers: corsHeaders });

      if (msg.key?.fromMe === true) {
        console.log("[whatsapp] Ignoring fromMe message");
        return new Response("ok", { headers: corsHeaders });
      }

      const remoteJidRaw: string = msg.key?.remoteJid || "";
      if (remoteJidRaw.endsWith("@g.us") || remoteJidRaw.includes("status@broadcast")) {
        console.log(`[whatsapp] Ignoring group/broadcast: ${remoteJidRaw}`);
        return new Response("ok", { headers: corsHeaders });
      }

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";

      const resolved = resolveSenderPhone(msg);
      console.log(`[whatsapp] remoteJid=${resolved.remoteJid} remoteJidAlt=${resolved.remoteJidAlt} senderPn=${resolved.senderPn} phoneResolved=${resolved.phone}`);

      if (!resolved.phone || !text) {
        console.log("[whatsapp] Skipping: no phone or no text");
        return new Response("ok", { headers: corsHeaders });
      }

      const instanceName = body.instance || body.data?.instance;
      const variants = phoneVariants(resolved.phone);

      // Per-instance AI restriction
      if (instanceName) {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("ai_allowed_phone")
          .eq("instance_name", instanceName)
          .maybeSingle();
        const allowed = (inst?.ai_allowed_phone || "").replace(/\D/g, "");
        if (allowed) {
          const allowedVariants = phoneVariants(allowed);
          const match = variants.some((v) => allowedVariants.includes(v));
          if (!match) {
            console.log(`[whatsapp] Phone ${resolved.phone} not in AI-allowed list (${allowed}) for instance ${instanceName} — silently ignoring`);
            return new Response("ok", { headers: corsHeaders });
          }
        }
      }

      console.log(`[whatsapp] Looking up profile with phone variants: ${variants.join(", ")}`);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, workspace_id, name, phone")
        .in("phone", variants)
        .limit(1);

      const profile = profiles?.[0];
      if (!profile) {
        console.log(`[whatsapp] No profile matched for phone=${resolved.phone}`);
        if (instanceName) {
          await sendWhatsAppMessageViaInstance(supabase, instanceName, resolved.phone, "❌ Seu número não está cadastrado no Alexandre. Cadastre-o nas Configurações do app.");
        }
        return new Response("ok", { headers: corsHeaders });
      }

      console.log(`[whatsapp] Matched profile user_id=${profile.user_id} name=${profile.name}`);

      if (!LOVABLE_API_KEY) {
        console.error("LOVABLE_API_KEY not set");
        return new Response("ok", { headers: corsHeaders });
      }

      // Load WhatsApp conversation history
      const history = await loadWhatsAppHistory(supabase, profile.user_id, profile.workspace_id, 10);
      console.log(`[whatsapp] Loaded ${history.length} prior messages for context`);

      // Run shared chat turn (same logic as in-app chat, in read-only mode)
      let replyText: string;
      try {
        replyText = await runChatTurn({
          supabase,
          apiKey: LOVABLE_API_KEY,
          userId: profile.user_id,
          userMessage: text,
          history,
        });
      } catch (e) {
        console.error("[whatsapp] runChatTurn error:", e);
        replyText = "Desculpe, tive um problema para processar sua mensagem agora. Tente de novo em instantes.";
      }

      // Strip markdown as a safety net
      replyText = sanitizeForWhatsApp(replyText);

      console.log(`[whatsapp] AI reply length=${replyText.length} preview="${replyText.slice(0, 120)}"`);

      // Persist messages for future context
      await saveChatMessage(supabase, profile.user_id, profile.workspace_id, "user", text);
      await saveChatMessage(supabase, profile.user_id, profile.workspace_id, "assistant", replyText);

      if (instanceName) {
        await sendWhatsAppMessageViaInstance(supabase, instanceName, resolved.phone, replyText);
      }

      return new Response("ok", { headers: corsHeaders });
    }

    // ---- Internal: send a notification ----
    if (body.action === "send_notification") {
      const { phone: targetPhone, message: notifMessage, workspace_id } = body;
      if (!targetPhone || !notifMessage) {
        return new Response(JSON.stringify({ error: "Missing phone/message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cleanPhone = String(targetPhone).replace(/\D/g, "");

      const query = supabase
        .from("whatsapp_instances")
        .select("id, instance_name, workspace_id")
        .eq("status", "connected")
        .eq("is_active", true);
      if (workspace_id) query.eq("workspace_id", workspace_id);
      const { data: instances } = await query.limit(1);
      const inst = instances?.[0];

      if (!inst) {
        return new Response(JSON.stringify({ error: "No connected instance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const creds = await readEvolutionCredentials(supabase, inst.id);
      if (!creds) {
        return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const baseUrl = creds.api_url.replace(/\/$/, "").replace(/\/manager$/, "");
      const sendRes = await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: creds.api_key },
        body: JSON.stringify({ number: cleanPhone, text: notifMessage }),
      });
      console.log(`[whatsapp] notification send status=${sendRes.status}`);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("whatsapp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsAppMessageViaInstance(supabase: any, instanceName: string, phone: string, text: string) {
  const cleanPhone = String(phone).replace(/\D/g, "");

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name")
    .eq("instance_name", instanceName)
    .single();

  if (!instance) {
    console.warn(`[whatsapp] Instance ${instanceName} not found`);
    return;
  }

  const creds = await readEvolutionCredentials(supabase, instance.id);
  if (!creds) {
    console.warn(`[whatsapp] Missing vault secrets for instance ${instanceName}`);
    return;
  }

  const baseUrl = creds.api_url.replace(/\/$/, "").replace(/\/manager$/, "");
  const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: creds.api_key },
    body: JSON.stringify({
      number: cleanPhone,
      text,
      delay: 0,
      linkPreview: false,
    }),
  });
  const respBody = await res.text();
  console.log(`[whatsapp] sendText to ${cleanPhone} via ${instanceName} → status=${res.status} body=${respBody.slice(0, 300)}`);
}
