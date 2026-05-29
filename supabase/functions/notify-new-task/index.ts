/**
 * notify-new-task
 *
 * Chamada via Database Webhook do Supabase quando uma task é inserida
 * ou quando assignee_id muda em um UPDATE.
 *
 * Payload esperado (Supabase Webhook padrão):
 * { type: "INSERT" | "UPDATE", table: "tasks", record: Task, old_record?: Task }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailNewTask } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { type, record, old_record } = body;

    // Ignorar se não há assignee
    if (!record?.assignee_id) {
      return new Response(JSON.stringify({ skipped: "sem assignee" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Em UPDATE, só notifica se o assignee mudou
    if (type === "UPDATE" && old_record?.assignee_id === record.assignee_id) {
      return new Response(JSON.stringify({ skipped: "assignee não mudou" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Buscar dados da tarefa ──
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, description, due_date, collection_id, collections(name)")
      .eq("id", record.id)
      .single();

    if (!task) throw new Error(`Task ${record.id} não encontrada`);

    // ── Buscar perfil do assignee ──
    const { data: assignee } = await supabase
      .from("profiles")
      .select("name, email, phone, whatsapp_notifications, notification_preferences, workspace_id")
      .eq("user_id", record.assignee_id)
      .single();

    if (!assignee) throw new Error(`Perfil do assignee ${record.assignee_id} não encontrado`);

    const prefs = assignee.notification_preferences || {};
    const collectionName = (task.collections as any)?.name ?? "";
    const dueDate = task.due_date
      ? new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR")
      : undefined;

    let emailSent = false;
    let whatsappSent = false;

    // ── Notificação in-app ──
    await supabase.from("notifications").insert({
      user_id: record.assignee_id,
      type: "task_assigned",
      message: `Nova tarefa atribuída a você: ${task.title}`,
      reference_id: task.id,
      reference_type: "task",
    });

    // ── Email ──
    const emailEnabled = prefs.new_task !== "whatsapp_only" && !!assignee.email;
    if (emailEnabled) {
      try {
        const html = emailNewTask({
          assigneeName: assignee.name ?? "Usuário",
          taskTitle: task.title,
          taskDescription: task.description ?? undefined,
          collectionName,
          dueDate,
        });

        await sendEmail({
          to: assignee.email,
          subject: `📋 Nova tarefa: ${task.title}`,
          html,
        });

        emailSent = true;
      } catch (emailErr) {
        console.error("Erro ao enviar email de nova tarefa:", emailErr);
      }
    }

    // ── WhatsApp ──
    const shouldSendWA =
      prefs.new_task === "whatsapp" ||
      prefs.new_task === "both" ||
      prefs.new_task === "whatsapp_only" ||
      assignee.whatsapp_notifications;

    if (shouldSendWA && assignee.phone) {
      const lines = [
        `📋 *Nova tarefa atribuída a você!*`,
        ``,
        `*${task.title}*`,
        task.description ? task.description : "",
        ``,
        `📁 ${collectionName}`,
        dueDate ? `📅 Prazo: ${dueDate}` : "",
      ].filter((l) => l !== undefined);

      await supabase.functions.invoke("whatsapp", {
        body: {
          action: "send_notification",
          phone: assignee.phone,
          message: lines.join("\n"),
          workspace_id: assignee.workspace_id,
        },
      });
      whatsappSent = true;
    }

    return new Response(JSON.stringify({ success: true, emailSent, whatsappSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-new-task error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
