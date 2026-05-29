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
    const { task_id, assigner_id } = await req.json();

    if (!task_id) {
      return new Response(JSON.stringify({ error: "task_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Buscar dados da task ─────────────────────────────────────────
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, description, assignee_id, collection_id, due_date, collections(name)")
      .eq("id", task_id)
      .single();

    if (!task || !task.assignee_id) {
      return new Response(JSON.stringify({ message: "Task sem responsável" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Buscar perfil do responsável ────────────────────────────────
    const { data: assignee } = await supabase
      .from("profiles")
      .select("name, email, notification_preferences")
      .eq("user_id", task.assignee_id)
      .single();

    if (!assignee?.email) {
      return new Response(JSON.stringify({ message: "Responsável sem email cadastrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Verificar preferência de email para novas tasks ────────────
    const prefs = (assignee.notification_preferences as Record<string, string>) || {};
    const newTaskPref = prefs["new_task"] || "email"; // default: email
    const emailEnabled = newTaskPref === "email" || newTaskPref === "both" || newTaskPref === "all";

    if (!emailEnabled) {
      return new Response(
        JSON.stringify({ message: "Notificação de email desabilitada para novas tasks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Buscar nome de quem atribuiu (opcional) ─────────────────────
    let assignerName: string | undefined;
    if (assigner_id) {
      const { data: assigner } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", assigner_id)
        .single();
      assignerName = assigner?.name ?? undefined;
    }

    // ── 5. Formatar data de prazo ──────────────────────────────────────
    const dueDateFormatted = task.due_date
      ? new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR")
      : undefined;

    const collectionName = (task.collections as any)?.name || "Sem coleção";

    // ── 6. Montar e enviar email ───────────────────────────────────────
    const html = emailNewTask({
      assigneeName: assignee.name || "Usuário",
      taskTitle: task.title,
      taskDescription: task.description ?? undefined,
      collectionName,
      dueDate: dueDateFormatted,
      assignerName,
    });

    await sendEmail({
      to: assignee.email,
      subject: `📋 Nova tarefa: ${task.title}`,
      html,
    });

    console.info("[notify-task-assigned] Email enviado", {
      to: assignee.email,
      task_id,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-task-assigned] Erro:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
