// Shared chat-core: workspace context, permissions, search_tasks tool,
// and a unified `runChatTurn` that executes a complete conversation turn
// (1st AI call → search_tasks if needed → 2nd AI call → final string).
//
// Used by both `chat/index.ts` (in-app chat, with full mutation tools and SSE)
// and `whatsapp/index.ts` (read-only, returns plain text).

const AI_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Permission helpers ──────────────────────────────────────────────

export async function getUserContext(supabase: any, userId: string) {
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

export function canSeeTask(
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

// ── Workspace context ───────────────────────────────────────────────

export async function fetchWorkspaceContext(
  supabase: any,
  workspaceId: string,
  userId: string,
  role: string,
  teamMemberIds: string[],
) {
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false);

  const { data: allColumns } = await supabase
    .from("columns")
    .select("id, name, position, collection_id, wip_limit")
    .order("position");

  const { data: members } = await supabase
    .from("profiles")
    .select("user_id, name, email, phone")
    .eq("workspace_id", workspaceId);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, start_date, end_date")
    .eq("workspace_id", workspaceId);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("team_id, user_id");

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

  const { data: wsSettings } = await supabase
    .from("workspaces")
    .select("daily_work_hours, work_start_time, weekend_days")
    .eq("id", workspaceId)
    .single();

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

// ── System prompt ────────────────────────────────────────────────────

export type ChatChannel = "app" | "whatsapp";

export function buildSystemPrompt(
  userName: string,
  role: string,
  teamMemberIds: string[],
  ctx: Awaited<ReturnType<typeof fetchWorkspaceContext>>,
  channel: ChatChannel = "app",
) {
  const today = new Date().toISOString().split("T")[0];

  const collDetails = ctx.collections.map((col: any) => {
    const cols = ctx.columns
      .filter((c: any) => c.collection_id === col.id)
      .sort((a: any, b: any) => a.position - b.position)
      .map((c: any) => ({ id: c.id, name: c.name, position: c.position }));
    return { id: col.id, name: col.name, columns: cols };
  });

  const teamDetails = ctx.teams.map((t: any) => {
    const memberIds = ctx.teamMembers
      .filter((tm: any) => tm.team_id === t.id)
      .map((tm: any) => tm.user_id);
    const memberNames = memberIds.map((uid: string) =>
      ctx.members.find((m: any) => m.user_id === uid)?.name || uid
    );
    return { id: t.id, name: t.name, members: memberNames };
  });

  const totalTasks = ctx.tasks.length;
  const doneTasks = ctx.tasks.filter((t: any) => t.is_done).length;
  const overdueTasks = ctx.tasks.filter((t: any) => t.due_date && t.due_date < today && !t.is_done).length;
  const urgentTasks = ctx.tasks.filter((t: any) => t.priority === "urgente" && !t.is_done).length;

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

  const channelInstructions = channel === "whatsapp"
    ? `
== CANAL: WHATSAPP ==

- Responda em texto puro corrido. NUNCA use markdown (sem **negrito**, sem _italico_, sem # cabecalhos, sem \`codigo\`).
- Use listas simples com "- " no inicio da linha quando precisar enumerar.
- Voce esta em modo SOMENTE LEITURA: pode consultar tasks, prazos, coleções, equipe e usar a tool search_tasks. NAO pode criar/alterar/excluir nada.
- Se o usuario pedir para criar/editar/excluir algo, responda gentilmente que via WhatsApp voce so consegue consultar — pode pedir para ele usar o app.
- Quando o usuario perguntar "minhas tasks de DD/MM", "tasks de amanha", etc, use search_tasks com due_before e due_after iguais a aquela data e LISTE TODAS as tasks retornadas, sem omitir nenhuma.
`
    : `
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
`;

  return `Voce e a IA do TaskAI, assistente de gerenciamento de tarefas. Responda em portugues brasileiro, conciso e amigavel. Hoje e ${today}.

Usuario: ${userName} (${role})
${permissionNote}
${channelInstructions}
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

// ── Search & today helpers ──────────────────────────────────────────

export function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchVisibleTasks(
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

export function isTodayTasksIntent(content: string) {
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

export function isDueTodayOnlyFilter(filters: Record<string, unknown>, today: string) {
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

function formatTaskListItem(task: any, plain = false) {
  const details = [
    task.collection,
    task.project ? `projeto ${task.project}` : null,
    task.priority ? `prioridade ${task.priority}` : null,
    task.due_date ? `prazo ${formatTaskDate(task.due_date)}` : "sem prazo",
  ].filter(Boolean);

  const title = plain ? task.title : `**${task.title}**`;
  return `- ${title}${details.length ? ` — ${details.join(" · ")}` : ""}`;
}

export function buildTodayTasksSummaryResponse(
  ctx: Awaited<ReturnType<typeof fetchWorkspaceContext>>,
  userId: string,
  today: string,
  channel: ChatChannel = "app",
) {
  const plain = channel === "whatsapp";
  const collectionsById = new Map(ctx.collections.map((collection: any) => [collection.id, collection.name || null]));
  const projectsById = new Map(ctx.projects.map((project: any) => [project.id, project.name || null]));

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

  const todayTasks = myOpenTasks.filter((task: any) => task.due_date === today || task.hasOverrideToday);
  const otherOpenTasks = myOpenTasks.filter((task: any) => task.due_date !== today && !task.hasOverrideToday);
  const lines: string[] = [];

  const bold = (s: string) => plain ? s : `**${s}**`;

  if (todayTasks.length > 0) {
    lines.push(
      `Hoje você tem ${bold(`${todayTasks.length} ${todayTasks.length === 1 ? "task para hoje" : "tasks para hoje"}`)} (incluindo agendamentos), e no total existem ${bold(`${myOpenTasks.length} ${myOpenTasks.length === 1 ? "task pendente" : "tasks pendentes"}`)} atribuídas a você.`,
    );
    lines.push("");
    lines.push(`${bold("Para hoje:")}`);
    lines.push(...todayTasks.map((t: any) => formatTaskListItem(t, plain)));
  } else {
    lines.push(
      `Hoje você não tem tasks agendadas para hoje, mas existem ${bold(`${myOpenTasks.length} ${myOpenTasks.length === 1 ? "task pendente" : "tasks pendentes"}`)} atribuídas a você.`,
    );
  }

  if (otherOpenTasks.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(`${bold("Outras pendentes abertas:")}`);
    lines.push(...otherOpenTasks.map((t: any) => formatTaskListItem(t, plain)));
  }

  return lines.join("\n");
}

// ── AI calls ─────────────────────────────────────────────────────────

export async function callAi(apiKey: string, payload: Record<string, unknown>) {
  return fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: AI_MODEL, ...payload }),
  });
}

export function extractAssistantContent(content: unknown) {
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

// ── Tool definitions ────────────────────────────────────────────────

export const SEARCH_TASKS_TOOL = {
  type: "function",
  function: {
    name: "search_tasks",
    description: "Search/filter tasks. Use this when the user asks about specific tasks, deadlines, assignees, or tasks for a specific date. Returns matching tasks.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search in task titles and descriptions" },
        assignee_name: { type: "string", description: "Filter by assignee name" },
        collection_name: { type: "string", description: "Filter by collection name" },
        project_name: { type: "string", description: "Filter by project name" },
        priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
        is_done: { type: "boolean", description: "Filter by done status" },
        due_before: { type: "string", description: "YYYY-MM-DD — tasks due on or before this date" },
        due_after: { type: "string", description: "YYYY-MM-DD — tasks due on or after this date" },
      },
    },
  },
};

// ── Unified turn for read-only channels (WhatsApp) ───────────────────

export type ChatHistoryMsg = { role: "user" | "assistant"; content: string };

/**
 * Runs a complete chat turn for a read-only channel (WhatsApp).
 * - Builds full context via fetchWorkspaceContext + buildSystemPrompt(channel="whatsapp")
 * - Exposes only `search_tasks` tool
 * - Handles "today tasks" deterministic shortcut
 * - On `search_tasks`, executes locally and does the 2nd AI call with results
 * - Returns the final assistant text (plain string)
 */
export async function runChatTurn(opts: {
  supabase: any;
  apiKey: string;
  userId: string;
  userMessage: string;
  history?: ChatHistoryMsg[];
}): Promise<string> {
  const { supabase, apiKey, userId, userMessage, history = [] } = opts;

  const userCtx = await getUserContext(supabase, userId);
  if (!userCtx) return "Não consegui identificar seu perfil no workspace.";

  const wsCtx = await fetchWorkspaceContext(
    supabase,
    userCtx.workspaceId,
    userId,
    userCtx.role,
    userCtx.teamMemberIds,
  );

  const systemPrompt = buildSystemPrompt(
    userCtx.userName,
    userCtx.role,
    userCtx.teamMemberIds,
    wsCtx,
    "whatsapp",
  );

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: userMessage },
  ];

  const initial = await callAi(apiKey, {
    messages,
    tools: [SEARCH_TASKS_TOOL],
    stream: false,
  });

  if (!initial.ok) {
    console.error("[chat-core] initial AI error", initial.status, await initial.text());
    return "Desculpe, não consegui processar sua mensagem agora.";
  }

  const initialJson = await initial.json();
  const initialMessage = initialJson?.choices?.[0]?.message;
  const initialContent = extractAssistantContent(initialMessage?.content);
  const firstToolCall = initialMessage?.tool_calls?.[0];

  if (!firstToolCall) {
    return initialContent || "Desculpe, não consegui gerar uma resposta agora.";
  }

  const toolName = firstToolCall?.function?.name;
  const toolArguments = typeof firstToolCall?.function?.arguments === "string"
    ? firstToolCall.function.arguments
    : "{}";

  // Read-only: any tool other than search_tasks → friendly fallback
  if (toolName !== "search_tasks") {
    return initialContent || "Via WhatsApp consigo apenas consultar suas tasks — para criar ou alterar dados, use o app.";
  }

  let searchFilters: Record<string, unknown> = {};
  try {
    searchFilters = JSON.parse(toolArguments || "{}");
  } catch (e) {
    console.error("[chat-core] search_tasks args parse error", e, toolArguments);
  }

  const today = new Date().toISOString().split("T")[0];
  if (isTodayTasksIntent(userMessage) && isDueTodayOnlyFilter(searchFilters, today)) {
    return buildTodayTasksSummaryResponse(wsCtx, userId, today, "whatsapp");
  }

  const matchingTasks = searchVisibleTasks(wsCtx, searchFilters);
  console.info("[chat-core] search_tasks executed", {
    userId,
    filters: searchFilters,
    results: matchingTasks.length,
  });

  const normalizedToolCall = {
    id: firstToolCall.id || `tool_search_tasks_${crypto.randomUUID()}`,
    type: "function",
    function: { name: "search_tasks", arguments: toolArguments },
  };

  const followUp = await callAi(apiKey, {
    messages: [
      ...messages,
      { role: "assistant", content: initialContent || "", tool_calls: [normalizedToolCall] },
      {
        role: "tool",
        tool_call_id: normalizedToolCall.id,
        content: JSON.stringify({ count: matchingTasks.length, tasks: matchingTasks }),
      },
    ],
    stream: false,
  });

  if (!followUp.ok) {
    console.error("[chat-core] follow-up AI error", followUp.status, await followUp.text());
    if (matchingTasks.length === 0) return "Não encontrei tasks com esses filtros.";
    // Fallback: format the list ourselves so the user doesn't get nothing.
    const lines = matchingTasks.map((t: any) => {
      const parts = [t.collection, t.due_date ? `prazo ${formatTaskDate(t.due_date)}` : null, t.priority ? `prioridade ${t.priority}` : null].filter(Boolean);
      return `- ${t.title}${parts.length ? ` — ${parts.join(" · ")}` : ""}`;
    });
    return `Encontrei ${matchingTasks.length} task(s):\n${lines.join("\n")}`;
  }

  const followUpJson = await followUp.json();
  const followUpMessage = followUpJson?.choices?.[0]?.message;
  const followUpContent = extractAssistantContent(followUpMessage?.content);

  return followUpContent || (matchingTasks.length > 0
    ? `Encontrei ${matchingTasks.length} task(s), mas não consegui resumir agora.`
    : "Não encontrei tasks com esses filtros.");
}
