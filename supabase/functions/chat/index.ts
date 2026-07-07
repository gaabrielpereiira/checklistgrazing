import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Permission helpers ──────────────────────────────────────────────

async function getUserContext(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, workspace_id, phone")
    .eq("user_id", userId)
    .single();
  if (!profile?.workspace_id) return null;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  const role = roleRow?.role || "usuario";

  // Team member IDs for gestor
  let teamMemberIds: string[] = [];
  if (role === "gestor") {
    const { data: myTeams } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId);
    if (myTeams?.length) {
      const teamIds = myTeams.map((t: any) => t.team_id);
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", teamIds)
        .neq("user_id", userId);
      teamMemberIds = [...new Set((members || []).map((m: any) => m.user_id))] as string[];
    }
  }

  return {
    profileId: profile.id,
    userName: profile.name,
    workspaceId: profile.workspace_id,
    role,
    teamMemberIds,
  };
}

/** Build task filter based on role */
function canSeeTask(
  task: any,
  role: string,
  userId: string,
  teamMemberIds: string[],
): boolean {
  if (role === "admin") return true;
  if (task.assignee_id === userId) return true;
  if (role === "gestor" && teamMemberIds.includes(task.assignee_id)) return true;
  return false;
}

// ── Fetch workspace data respecting permissions ─────────────────────

async function fetchWorkspaceContext(
  supabase: any,
  workspaceId: string,
  userId: string,
  role: string,
  teamMemberIds: string[],
) {
  // Collections (non-archived)
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false);

  // Columns
  const { data: allColumns } = await supabase
    .from("columns")
    .select("id, name, position, collection_id, wip_limit")
    .order("position");

  // Members
  const { data: members } = await supabase
    .from("profiles")
    .select("user_id, name, email, phone")
    .eq("workspace_id", workspaceId);

  // Projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, start_date, end_date")
    .eq("workspace_id", workspaceId);

  // Teams
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("team_id, user_id");

  // All active tasks (with permission filtering)
  const collectionIds = (collections || []).map((c: any) => c.id);
  let tasks: any[] = [];
  if (collectionIds.length > 0) {
    const { data: allTasks } = await supabase
      .from("tasks")
      .select("id, title, description, collection_id, column_id, assignee_id, priority, due_date, duration_hours, is_done, is_archived, project_id, created_at")
      .in("collection_id", collectionIds)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(200);

    tasks = (allTasks || []).filter((t: any) => canSeeTask(t, role, userId, teamMemberIds));
  }

  // Workspace settings
  const { data: wsSettings } = await supabase
    .from("workspaces")
    .select("daily_work_hours, work_start_time, weekend_days")
    .eq("id", workspaceId)
    .single();

  // Schedule overrides (for "today" queries)
  const { data: scheduleOverrides } = await supabase
    .from("task_schedule_overrides")
    .select("task_id, work_date, hours, start_hour");

  return {
    collections: collections || [],
    columns: allColumns || [],
    members: members || [],
    projects: projects || [],
    teams: teams || [],
    teamMembers: teamMembers || [],
    tasks,
    settings: wsSettings,
    scheduleOverrides: scheduleOverrides || [],
  };
}

// ── Build system prompt ─────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  role: string,
  teamMemberIds: string[],
  ctx: Awaited<ReturnType<typeof fetchWorkspaceContext>>,
) {
  const today = new Date().toISOString().split("T")[0];

  // Build collections with columns
  const collDetails = ctx.collections.map((col: any) => {
    const cols = ctx.columns
      .filter((c: any) => c.collection_id === col.id)
      .sort((a: any, b: any) => a.position - b.position)
      .map((c: any) => ({ id: c.id, name: c.name, position: c.position }));
    return { id: col.id, name: col.name, columns: cols };
  });

  // Build teams with members
  const teamDetails = ctx.teams.map((t: any) => {
    const memberIds = ctx.teamMembers
      .filter((tm: any) => tm.team_id === t.id)
      .map((tm: any) => tm.user_id);
    const memberNames = memberIds.map((uid: string) =>
      ctx.members.find((m: any) => m.user_id === uid)?.name || uid
    );
    return { id: t.id, name: t.name, members: memberNames };
  });

  // Task stats
  const totalTasks = ctx.tasks.length;
  const doneTasks = ctx.tasks.filter((t: any) => t.is_done).length;
  const overdueTasks = ctx.tasks.filter((t: any) => t.due_date && t.due_date < today && !t.is_done).length;
  const urgentTasks = ctx.tasks.filter((t: any) => t.priority === "urgente" && !t.is_done).length;

  // Tasks per assignee
  const tasksByAssignee = new Map<string, number>();
  for (const t of ctx.tasks) {
    if (t.assignee_id && !t.is_done) {
      tasksByAssignee.set(t.assignee_id, (tasksByAssignee.get(t.assignee_id) || 0) + 1);
    }
  }
  const assigneeLoad = Array.from(tasksByAssignee.entries()).map(([uid, count]) => {
    const name = ctx.members.find((m: any) => m.user_id === uid)?.name || uid;
    const hours = ctx.tasks
      .filter((t: any) => t.assignee_id === uid && !t.is_done)
      .reduce((sum: number, t: any) => sum + (t.duration_hours || 0), 0);
    return `${name}: ${count} tasks (${hours}h)`;
  }).join("\n");

  let permissionNote = "";
  if (role === "admin") {
    permissionNote = "Voce e ADMIN — ve todas as tasks do workspace.";
  } else if (role === "gestor") {
    const managedNames = teamMemberIds.map(uid =>
      ctx.members.find((m: any) => m.user_id === uid)?.name || uid
    ).join(", ");
    permissionNote = `Voce e GESTOR — ve suas tasks e as de sua equipe: ${managedNames || "nenhum membro"}.`;
  } else {
    permissionNote = "Voce e USUARIO — ve apenas suas proprias tasks.";
  }

  return `Voce e a IA do Alexandre, assistente de gerenciamento de tarefas. Responda em portugues brasileiro, conciso e amigavel. Hoje e ${today}.

Usuario: ${userName} (${role})
${permissionNote}

== CAPACIDADES ==

1. **Pesquisa e consulta** — responda perguntas sobre tasks, projetos, equipes, prazos, carga de trabalho
2. **Criar tasks** — use a tool create_tasks (APENAS para tasks novas, nunca para reorganizar existentes)
3. **Criar projetos** — use a tool create_project
4. **Registrar impedimentos** — use a tool register_impediment
5. **Criar solicitacoes** — use a tool create_request
6. **Buscar tasks** — use a tool search_tasks para consultas especificas
7. **Atualizar tasks existentes** — use a tool update_tasks para mudar due_date, priority, assignee_id, duration_hours, is_done
8. **Reagendar/redistribuir tasks** — use a tool set_task_schedule para definir em quais dias e horas a task sera trabalhada (substitui os agendamentos atuais da task)

== REGRAS ==

- Para perguntas sobre tasks, projetos, prazos: use o contexto abaixo + search_tasks se precisar de mais detalhes
- Quando o usuario perguntar "quais minhas tasks", "o que tenho pra hoje", etc: responda com base nos dados
- Duracao de tasks e SEMPRE em horas (duration_hours). Nunca use dias.
- Respeite o permissionamento: so fale sobre tasks que o usuario pode ver
- Ao criar tasks, use collection_id e column_id do contexto. Use a primeira coluna como default.
- Se o pedido e vago, faca perguntas pra coletar informacoes
- **REORGANIZAR / REDISTRIBUIR tasks existentes:** NUNCA use create_tasks. Use update_tasks (para mudar due_date) e/ou set_task_schedule (para redistribuir horas pelos dias). Considere os schedule_overrides ja existentes de outras tasks do mesmo assignee para nao sobrepor horarios. Respeite weekend_days e o expediente diario (work_start_time + daily_work_hours).
- Ao usar set_task_schedule, envie TODOS os dias de trabalho da task (a tool substitui os agendamentos existentes). A soma das horas deve bater com duration_hours da task.

== CONFIGURACOES DO WORKSPACE ==

- Horas por dia: ${ctx.settings?.daily_work_hours || 8}h
- Inicio do expediente: ${ctx.settings?.work_start_time || "09:00"}
- Dias de folga: ${(ctx.settings?.weekend_days || [0, 6]).map((d: number) => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][d]).join(", ")}

== RESUMO ==

- Tasks ativas: ${totalTasks - doneTasks} (${doneTasks} concluidas)
- Atrasadas: ${overdueTasks}
- Urgentes: ${urgentTasks}

Carga por responsavel:
${assigneeLoad || "Nenhuma task atribuida"}

== COLECOES E COLUNAS ==

${JSON.stringify(collDetails, null, 2)}

== MEMBROS ==

${JSON.stringify(ctx.members.map((m: any) => ({ user_id: m.user_id, name: m.name, email: m.email })), null, 2)}

== EQUIPES ==

${JSON.stringify(teamDetails, null, 2)}

== PROJETOS ==

${JSON.stringify(ctx.projects, null, 2)}

== TASKS (ultimas ${ctx.tasks.length}, nao-arquivadas) ==

${JSON.stringify(ctx.tasks.map((t: any) => {
  const overrides = ctx.scheduleOverrides
    .filter((o: any) => o.task_id === t.id)
    .sort((a: any, b: any) => (a.work_date || "").localeCompare(b.work_date || ""))
    .map((o: any) => ({ date: o.work_date, start_hour: Number(o.start_hour), hours: Number(o.hours) }));
  return {
    id: t.id,
    title: t.title,
    collection: ctx.collections.find((c: any) => c.id === t.collection_id)?.name,
    column: ctx.columns.find((c: any) => c.id === t.column_id)?.name,
    assignee_id: t.assignee_id,
    assignee: ctx.members.find((m: any) => m.user_id === t.assignee_id)?.name || null,
    priority: t.priority,
    due_date: t.due_date,
    duration_hours: t.duration_hours,
    is_done: t.is_done,
    project: ctx.projects.find((p: any) => p.id === t.project_id)?.name || null,
    schedule_overrides: overrides,
  };
}), null, 2)}`;
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchVisibleTasks(
  ctx: Awaited<ReturnType<typeof fetchWorkspaceContext>>,
  filters: Record<string, unknown>,
) {
  const membersById = new Map(ctx.members.map((member: any) => [member.user_id, member.name || ""]));
  const collectionsById = new Map(ctx.collections.map((collection: any) => [collection.id, collection.name || ""]));
  const columnsById = new Map(ctx.columns.map((column: any) => [column.id, column.name || ""]));
  const projectsById = new Map(ctx.projects.map((project: any) => [project.id, project.name || ""]));

  const query = normalizeText(typeof filters.query === "string" ? filters.query : "");
  const assigneeName = normalizeText(typeof filters.assignee_name === "string" ? filters.assignee_name : "");
  const collectionName = normalizeText(typeof filters.collection_name === "string" ? filters.collection_name : "");
  const projectName = normalizeText(typeof filters.project_name === "string" ? filters.project_name : "");
  const priority = typeof filters.priority === "string" ? filters.priority : undefined;
  const isDone = typeof filters.is_done === "boolean" ? filters.is_done : undefined;
  const dueBefore = typeof filters.due_before === "string" ? filters.due_before : undefined;
  const dueAfter = typeof filters.due_after === "string" ? filters.due_after : undefined;

  return ctx.tasks
    .filter((task: any) => {
      const title = normalizeText(task.title);
      const description = normalizeText(task.description);
      const assignee = normalizeText(membersById.get(task.assignee_id));
      const collection = normalizeText(collectionsById.get(task.collection_id));
      const project = normalizeText(projectsById.get(task.project_id));
      const dueDate = typeof task.due_date === "string" ? task.due_date : null;

      if (query && !title.includes(query) && !description.includes(query)) return false;
      if (assigneeName && !assignee.includes(assigneeName)) return false;
      if (collectionName && !collection.includes(collectionName)) return false;
      if (projectName && !project.includes(projectName)) return false;
      if (priority && task.priority !== priority) return false;
      if (typeof isDone === "boolean" && task.is_done !== isDone) return false;
      if (dueBefore && (!dueDate || dueDate > dueBefore)) return false;
      if (dueAfter && (!dueDate || dueDate < dueAfter)) return false;

      return true;
    })
    .sort((a: any, b: any) => {
      const dueA = a.due_date || "9999-12-31";
      const dueB = b.due_date || "9999-12-31";
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return (b.created_at || "").localeCompare(a.created_at || "");
    })
    .map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      duration_hours: task.duration_hours,
      is_done: task.is_done,
      created_at: task.created_at,
      collection: collectionsById.get(task.collection_id) || null,
      column: columnsById.get(task.column_id) || null,
      assignee: membersById.get(task.assignee_id) || null,
      project: projectsById.get(task.project_id) || null,
    }));
}

function isTodayTasksIntent(content: string) {
  const normalized = normalizeText(content);

  // Frases fechadas comuns
  const exactPhrases = [
    "tasks de hoje", "task de hoje", "tarefas de hoje", "tarefa de hoje",
    "tasks do dia", "task do dia", "tarefas do dia", "tarefa do dia",
    "minhas tasks de hoje", "minhas tasks do dia", "minhas tarefas de hoje", "minhas tarefas do dia",
    "o que tenho pra hoje", "o que eu tenho pra hoje", "o que tenho hoje", "o que eu tenho hoje",
    "agenda de hoje", "agenda do dia", "meu dia",
  ];
  if (exactPhrases.some((pattern) => normalized.includes(pattern))) return true;

  // Heurística: precisa mencionar "hoje" (ou variações) + ser uma consulta/follow-up curto
  const mentionsToday = /\b(hoje|pra hoje|para hoje|de hoje|do dia)\b/.test(normalized);
  if (!mentionsToday) return false;

  // Follow-ups curtos: "e hoje?", "pra hoje", "hoje?", "hoje de novo"
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 6) return true;

  // Verbos/expressões de consulta ou re-consulta
  const queryVerbs = /\b(ver|veja|vejo|veria|conferir|confira|confere|checar|cheque|checa|olhar|olha|listar|lista|liste|mostrar|mostra|mostre|quais|tenho|tem|temos|agenda|novamente|de novo)\b/;
  return queryVerbs.test(normalized);
}

function isDueTodayOnlyFilter(filters: Record<string, unknown>, today: string) {
  const dueBefore = typeof filters.due_before === "string" ? filters.due_before : undefined;
  const dueAfter = typeof filters.due_after === "string" ? filters.due_after : undefined;

  const hasOtherFilters = Boolean(
    normalizeText(typeof filters.query === "string" ? filters.query : "") ||
    normalizeText(typeof filters.assignee_name === "string" ? filters.assignee_name : "") ||
    normalizeText(typeof filters.collection_name === "string" ? filters.collection_name : "") ||
    normalizeText(typeof filters.project_name === "string" ? filters.project_name : "") ||
    (typeof filters.priority === "string" ? filters.priority : "") ||
    typeof filters.is_done === "boolean"
  );

  return dueBefore === today && dueAfter === today && !hasOtherFilters;
}

function formatTaskDate(date: string | null | undefined) {
  if (!date) return "sem prazo";

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;

  return `${day}/${month}/${year}`;
}

function formatTaskListItem(task: any) {
  const details = [
    task.collection,
    task.project ? `projeto ${task.project}` : null,
    task.priority ? `prioridade ${task.priority}` : null,
    task.due_date ? `prazo ${formatTaskDate(task.due_date)}` : "sem prazo",
  ].filter(Boolean);

  return `- **${task.title}**${details.length ? ` — ${details.join(" · ")}` : ""}`;
}

function buildTodayTasksSummaryResponse(
  ctx: Awaited<ReturnType<typeof fetchWorkspaceContext>>,
  userId: string,
  today: string,
) {
  const collectionsById = new Map(ctx.collections.map((collection: any) => [collection.id, collection.name || null]));
  const projectsById = new Map(ctx.projects.map((project: any) => [project.id, project.name || null]));

  // Task IDs that have a schedule override for today
  const overrideTodayTaskIds = new Set(
    ctx.scheduleOverrides
      .filter((o: any) => o.work_date === today)
      .map((o: any) => o.task_id)
  );

  const myOpenTasks = ctx.tasks
    .filter((task: any) => task.assignee_id === userId && !task.is_done)
    .map((task: any) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      due_date: task.due_date,
      collection: collectionsById.get(task.collection_id),
      project: projectsById.get(task.project_id),
      hasOverrideToday: overrideTodayTaskIds.has(task.id),
    }));

  if (myOpenTasks.length === 0) {
    return "Hoje você não tem tasks pendentes atribuídas a você.";
  }

  // "Today" tasks = due today OR has a schedule override for today
  const todayTasks = myOpenTasks.filter((task: any) => task.due_date === today || task.hasOverrideToday);
  const otherOpenTasks = myOpenTasks.filter((task: any) => task.due_date !== today && !task.hasOverrideToday);
  const lines: string[] = [];

  if (todayTasks.length > 0) {
    lines.push(
      `Hoje você tem **${todayTasks.length} ${todayTasks.length === 1 ? "task para hoje" : "tasks para hoje"}** (incluindo agendamentos), e no total existem **${myOpenTasks.length} ${myOpenTasks.length === 1 ? "task pendente" : "tasks pendentes"}** atribuídas a você.`,
    );
    lines.push("");
    lines.push("**Para hoje:**");
    lines.push(...todayTasks.map(formatTaskListItem));
  } else {
    lines.push(
      `Hoje você não tem tasks agendadas para hoje, mas existem **${myOpenTasks.length} ${myOpenTasks.length === 1 ? "task pendente" : "tasks pendentes"}** atribuídas a você.`,
    );
  }

  if (otherOpenTasks.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Outras pendentes abertas:**");
    lines.push(...otherOpenTasks.map(formatTaskListItem));
  }

  return lines.join("\n");
}

async function callAi(
  apiKey: string,
  payload: Record<string, unknown>,
) {
  return fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      ...payload,
    }),
  });
}

async function parseAiResponse(response: Response) {
  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      return { errorResponse: new Response(JSON.stringify({ error: "Limite de requisicoes excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
    }
    if (status === 402) {
      return { errorResponse: new Response(JSON.stringify({ error: "Creditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
    }
    const text = await response.text();
    console.error("AI error:", status, text);
    return { errorResponse: new Response(JSON.stringify({ error: "Erro na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  return { data: await response.json() };
}

function extractAssistantContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  return "";
}

function buildSseChunk(delta: Record<string, unknown>, finishReason: string | null = null) {
  return {
    id: `chat-${crypto.randomUUID()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: AI_MODEL,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason,
        native_finish_reason: finishReason,
      },
    ],
  };
}

function createSseResponse(lines: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } },
  );
}

function createTextStreamResponse(content: string) {
  return createSseResponse([
    `data: ${JSON.stringify(buildSseChunk({ role: "assistant", content }))}\n\n`,
    `data: ${JSON.stringify(buildSseChunk({}, "stop"))}\n\n`,
    "data: [DONE]\n\n",
  ]);
}

function createToolCallStreamResponse(toolCall: any, content = "") {
  const lines: string[] = [];

  if (content) {
    lines.push(`data: ${JSON.stringify(buildSseChunk({ role: "assistant", content }))}\n\n`);
  }

  lines.push(`data: ${JSON.stringify(buildSseChunk({ role: "assistant", tool_calls: [toolCall] }))}\n\n`);
  lines.push(`data: ${JSON.stringify(buildSseChunk({}, "tool_calls"))}\n\n`);
  lines.push("data: [DONE]\n\n");

  return createSseResponse(lines);
}

// ── Tools definition ────────────────────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "search_tasks",
      description: "Search/filter tasks. Use this when the user asks about specific tasks, deadlines, assignees, etc. Returns matching tasks.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search in task titles and descriptions" },
          assignee_name: { type: "string", description: "Filter by assignee name" },
          collection_name: { type: "string", description: "Filter by collection name" },
          project_name: { type: "string", description: "Filter by project name" },
          priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
          is_done: { type: "boolean", description: "Filter by done status" },
          due_before: { type: "string", description: "YYYY-MM-DD — tasks due before this date" },
          due_after: { type: "string", description: "YYYY-MM-DD — tasks due after this date" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tasks",
      description: "Create one or more tasks. Each task can optionally have subtasks.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
                due_date: { type: "string", description: "YYYY-MM-DD" },
                duration_hours: { type: "number", description: "Duration in hours. Minimum 0.5." },
                collection_id: { type: "string" },
                column_id: { type: "string" },
                assignee_id: { type: "string", description: "user_id of the assignee" },
                project_id: { type: "string", description: "ID of the project" },
                subtasks: { type: "array", items: { type: "string" } },
              },
              required: ["title", "priority"],
            },
          },
        },
        required: ["tasks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new project with name, description, start date and end date.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["name", "start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "register_impediment",
      description: "Register an impediment/blocker on a task",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          task_title: { type: "string" },
          description: { type: "string" },
          suggest_request: { type: "boolean" },
          request_to_user_name: { type: "string" },
          request_task_title: { type: "string" },
        },
        required: ["task_id", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_request",
      description: "Create a task request/solicitation to another user",
      parameters: {
        type: "object",
        properties: {
          to_user_id: { type: "string" },
          task_title: { type: "string" },
          task_description: { type: "string" },
          suggested_due_date: { type: "string", description: "YYYY-MM-DD" },
          impediment_id: { type: "string" },
        },
        required: ["task_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tasks",
      description: "Update one or more EXISTING tasks. Use to change due_date, priority, assignee, duration_hours, title, description or mark done. NEVER creates new tasks.",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string", description: "ID of the existing task to update" },
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
                due_date: { type: "string", description: "YYYY-MM-DD. Use empty string to clear." },
                duration_hours: { type: "number" },
                assignee_id: { type: "string" },
                is_done: { type: "boolean" },
              },
              required: ["task_id"],
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_task_schedule",
      description: "Replace the per-day schedule (overrides) of EXISTING tasks. Use to redistribute work across days. The provided days fully REPLACE any existing overrides for each task.",
      parameters: {
        type: "object",
        properties: {
          schedules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string", description: "ID of the existing task" },
                days: {
                  type: "array",
                  description: "Work days for this task. Replaces existing overrides.",
                  items: {
                    type: "object",
                    properties: {
                      work_date: { type: "string", description: "YYYY-MM-DD" },
                      start_hour: { type: "number", description: "Start hour as decimal (e.g. 9, 13.5)" },
                      hours: { type: "number", description: "Hours of work in this day (>0)" },
                    },
                    required: ["work_date", "start_hour", "hours"],
                  },
                },
              },
              required: ["task_id", "days"],
            },
          },
        },
        required: ["schedules"],
      },
    },
  },
];

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Invalid token");

    const userCtx = await getUserContext(supabase, user.id);
    if (!userCtx) throw new Error("User profile not found");

    const body = await req.json();
    if (!Array.isArray(body?.messages)) throw new Error("Invalid messages payload");

    const messages = body.messages
      .filter((message: any) => typeof message?.content === "string" && (message.role === "user" || message.role === "assistant"))
      .map((message: any) => ({
        role: message.role,
        content: message.content,
      }));

    const lastUserMessage = [...messages].reverse().find((message: any) => message.role === "user")?.content || "";

    if (messages.length === 0) throw new Error("No messages provided");

    const wsCtx = await fetchWorkspaceContext(
      supabase,
      userCtx.workspaceId,
      user.id,
      userCtx.role,
      userCtx.teamMemberIds,
    );

    const systemPrompt = buildSystemPrompt(
      userCtx.userName,
      userCtx.role,
      userCtx.teamMemberIds,
      wsCtx,
    );

    const initialAiResponse = await callAi(LOVABLE_API_KEY, {
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools,
      stream: false,
    });

    const initialAiResult = await parseAiResponse(initialAiResponse);
    if (initialAiResult.errorResponse) return initialAiResult.errorResponse;

    const initialMessage = initialAiResult.data?.choices?.[0]?.message;
    const initialContent = extractAssistantContent(initialMessage?.content);
    const firstToolCall = initialMessage?.tool_calls?.[0];

    if (!firstToolCall) {
      return createTextStreamResponse(initialContent || "Desculpe, nao consegui gerar uma resposta agora.");
    }

    const toolName = firstToolCall?.function?.name;
    const toolArguments = typeof firstToolCall?.function?.arguments === "string"
      ? firstToolCall.function.arguments
      : "{}";

    const normalizedToolCall = {
      id: firstToolCall.id || `tool_${toolName || "unknown"}_${crypto.randomUUID()}`,
      type: "function",
      function: {
        name: toolName || "",
        arguments: toolArguments,
      },
    };

    if (toolName !== "search_tasks") {
      console.info("chat tool call forwarded", { toolName, userId: user.id });
      return createToolCallStreamResponse(normalizedToolCall, initialContent);
    }

    let searchFilters: Record<string, unknown> = {};
    try {
      searchFilters = JSON.parse(toolArguments || "{}");
    } catch (parseError) {
      console.error("search_tasks arguments parse error:", parseError, toolArguments);
    }

    const matchingTasks = searchVisibleTasks(wsCtx, searchFilters);
    console.info("search_tasks executed", {
      userId: user.id,
      filters: searchFilters,
      results: matchingTasks.length,
    });

    const today = new Date().toISOString().split("T")[0];
    if (isTodayTasksIntent(lastUserMessage) && isDueTodayOnlyFilter(searchFilters, today)) {
      const summary = buildTodayTasksSummaryResponse(wsCtx, user.id, today);

      console.info("today_tasks summary generated", {
        userId: user.id,
        today,
        totalOpenAssigned: wsCtx.tasks.filter((task: any) => task.assignee_id === user.id && !task.is_done).length,
        dueTodayAssigned: wsCtx.tasks.filter((task: any) => task.assignee_id === user.id && !task.is_done && task.due_date === today).length,
      });

      return createTextStreamResponse(summary);
    }

    const followUpAiResponse = await callAi(LOVABLE_API_KEY, {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
        {
          role: "assistant",
          content: initialContent || "",
          tool_calls: [normalizedToolCall],
        },
        {
          role: "tool",
          tool_call_id: normalizedToolCall.id,
          content: JSON.stringify({
            count: matchingTasks.length,
            tasks: matchingTasks,
          }),
        },
      ],
      stream: false,
    });

    const followUpAiResult = await parseAiResponse(followUpAiResponse);
    if (followUpAiResult.errorResponse) return followUpAiResult.errorResponse;

    const followUpMessage = followUpAiResult.data?.choices?.[0]?.message;
    const followUpContent = extractAssistantContent(followUpMessage?.content);

    return createTextStreamResponse(
      followUpContent ||
        (matchingTasks.length > 0
          ? "Encontrei suas tasks, mas nao consegui resumir agora."
          : "Nao encontrei tasks com esses filtros."),
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
