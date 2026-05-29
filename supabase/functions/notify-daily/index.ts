import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Find tasks due today or tomorrow
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, assignee_id, collection_id, collections(name)")
      .or(`due_date.eq.${today},due_date.eq.${tomorrow}`)
      .not("assignee_id", "is", null);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks due today/tomorrow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by assignee
    const byUser: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      if (!t.assignee_id) continue;
      if (!byUser[t.assignee_id]) byUser[t.assignee_id] = [];
      byUser[t.assignee_id].push(t);
    }

    let notificationsCreated = 0;

    for (const [userId, userTasks] of Object.entries(byUser)) {
      const todayTasks = userTasks.filter(t => t.due_date === today);
      const tomorrowTasks = userTasks.filter(t => t.due_date === tomorrow);

      let message = "";
      if (todayTasks.length > 0) {
        const list = todayTasks.map(t => `• ${t.title}`).join("\n");
        message += `📅 Você tem ${todayTasks.length} task(s) com prazo HOJE:\n${list}`;
      }
      if (tomorrowTasks.length > 0) {
        if (message) message += "\n\n";
        const list = tomorrowTasks.map(t => `• ${t.title}`).join("\n");
        message += `⏰ ${tomorrowTasks.length} task(s) com prazo AMANHÃ:\n${list}`;
      }

      if (todayTasks.length > 0) {
        // Create in-app notification for today's tasks
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "task_due_today",
          message: `Você tem ${todayTasks.length} task(s) com prazo hoje`,
          reference_id: todayTasks[0].id,
          reference_type: "task",
        });
        notificationsCreated++;
      }

      // WhatsApp: check if user wants WhatsApp for this type
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, whatsapp_notifications, notification_preferences, workspace_id")
        .eq("user_id", userId)
        .single();

      if (!profile?.phone) continue;

      const prefs = profile.notification_preferences || {};
      const shouldSendWA = prefs.task_due_today === "whatsapp" || prefs.task_due_today === "both" || profile.whatsapp_notifications;

      if (shouldSendWA) {
        // Call whatsapp function to send
        await supabase.functions.invoke("whatsapp", {
          body: {
            action: "send_notification",
            phone: profile.phone,
            message,
            workspace_id: profile.workspace_id,
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, notificationsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-daily error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
