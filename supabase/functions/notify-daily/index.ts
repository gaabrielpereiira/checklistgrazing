import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailDailyDigest } from "../_shared/email.ts";

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
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // ── 1. Tarefas atrasadas (antes de hoje, não concluídas, não arquivadas) ──
    const { data: overdueTasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, assignee_id, collection_id, collections(name)")
      .lt("due_date", today)
      .eq("is_done", false)
      .eq("is_archived", false)
      .not("assignee_id", "is", null);

    // ── 2. Tarefas de hoje e amanhã ──
    const { data: dueTasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, assignee_id, collection_id, collections(name)")
      .or(`due_date.eq.${today},due_date.eq.${tomorrow}`)
      .eq("is_done", false)
      .eq("is_archived", false)
      .not("assignee_id", "is", null);

    const allTasks = [...(overdueTasks ?? []), ...(dueTasks ?? [])];

    if (allTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Sem tarefas pendentes para notificar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Agrupar por usuário ──
    const byUser: Record<string, {
      overdue: typeof allTasks;
      today: typeof allTasks;
      tomorrow: typeof allTasks;
    }> = {};

    for (const t of overdueTasks ?? []) {
      if (!t.assignee_id) continue;
      if (!byUser[t.assignee_id]) byUser[t.assignee_id] = { overdue: [], today: [], tomorrow: [] };
      byUser[t.assignee_id].overdue.push(t);
    }
    for (const t of dueTasks ?? []) {
      if (!t.assignee_id) continue;
      if (!byUser[t.assignee_id]) byUser[t.assignee_id] = { overdue: [], today: [], tomorrow: [] };
      if (t.due_date === today) byUser[t.assignee_id].today.push(t);
      else byUser[t.assignee_id].tomorrow.push(t);
    }

    let emailsSent = 0;
    let whatsappSent = 0;
    let notificationsCreated = 0;

    for (const [userId, userTasks] of Object.entries(byUser)) {
      // ── 4. Buscar perfil do usuário ──
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, phone, whatsapp_notifications, notification_preferences, workspace_id")
        .eq("user_id", userId)
        .single();

      if (!profile) continue;

      const prefs = profile.notification_preferences || {};

      // ── 5. Notificação in-app (tarefas de hoje) ──
      if (userTasks.today.length > 0) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "task_due_today",
          message: `Você tem ${userTasks.today.length} tarefa(s) com prazo hoje`,
          reference_id: userTasks.today[0].id,
          reference_type: "task",
        });
        notificationsCreated++;
      }

      // ── 6. Notificação in-app (tarefas atrasadas) ──
      if (userTasks.overdue.length > 0) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "task_overdue",
          message: `Você tem ${userTasks.overdue.length} tarefa(s) atrasada(s)`,
          reference_id: userTasks.overdue[0].id,
          reference_type: "task",
        });
        notificationsCreated++;
      }

      // ── 7. Email ──
      const emailEnabled = prefs.daily_digest !== "whatsapp_only" && !!profile.email;
      if (emailEnabled) {
        try {
          const html = emailDailyDigest({
            name: profile.name ?? "Usuário",
            overdue: userTasks.overdue.map((t) => ({
              title: t.title,
              collection: (t.collections as any)?.name ?? "",
              due_date: t.due_date,
            })),
            today: userTasks.today.map((t) => ({
              title: t.title,
              collection: (t.collections as any)?.name ?? "",
            })),
            tomorrow: userTasks.tomorrow.map((t) => ({
              title: t.title,
              collection: (t.collections as any)?.name ?? "",
            })),
          });

          await sendEmail({
            to: profile.email,
            subject: buildDailySubject(userTasks),
            html,
          });

          emailsSent++;
        } catch (emailErr) {
          console.error(`Erro ao enviar email para ${profile.email}:`, emailErr);
        }
      }

      // ── 8. WhatsApp ──
      if (!profile.phone) continue;

      const shouldSendWA =
        prefs.task_due_today === "whatsapp" ||
        prefs.task_due_today === "both" ||
        prefs.daily_digest === "whatsapp_only" ||
        profile.whatsapp_notifications;

      if (shouldSendWA) {
        const lines: string[] = [];

        if (userTasks.overdue.length > 0) {
          lines.push(`🚨 *${userTasks.overdue.length} tarefa(s) ATRASADA(s):*`);
          userTasks.overdue.forEach((t) => lines.push(`• ${t.title} (${t.due_date})`));
        }
        if (userTasks.today.length > 0) {
          if (lines.length) lines.push("");
          lines.push(`📅 *${userTasks.today.length} tarefa(s) para HOJE:*`);
          userTasks.today.forEach((t) => lines.push(`• ${t.title}`));
        }
        if (userTasks.tomorrow.length > 0) {
          if (lines.length) lines.push("");
          lines.push(`⏰ *${userTasks.tomorrow.length} tarefa(s) para AMANHÃ:*`);
          userTasks.tomorrow.forEach((t) => lines.push(`• ${t.title}`));
        }

        await supabase.functions.invoke("whatsapp", {
          body: {
            action: "send_notification",
            phone: profile.phone,
            message: lines.join("\n"),
            workspace_id: profile.workspace_id,
          },
        });
        whatsappSent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent, whatsappSent, notificationsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-daily error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ──
function buildDailySubject(userTasks: {
  overdue: unknown[];
  today: unknown[];
  tomorrow: unknown[];
}): string {
  const parts: string[] = [];
  if (userTasks.overdue.length > 0) parts.push(`🚨 ${userTasks.overdue.length} atrasada(s)`);
  if (userTasks.today.length > 0) parts.push(`📅 ${userTasks.today.length} para hoje`);
  if (userTasks.tomorrow.length > 0) parts.push(`⏰ ${userTasks.tomorrow.length} para amanhã`);
  return `Grazing Tasks — ${parts.join(" · ")}`;
}
