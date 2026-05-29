import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Loader2, Plus, MessageSquare, Trash2, X, Check, Pencil, Calendar, Flag, FolderOpen, User, ListChecks, Minus, CheckCircle2, Mail, Clock, GanttChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections, useCreateTask, useCreateSubtask, useCreateImpediment, useProfiles, useCreateProject, useProjects, useAllTasks, useUpdateTask, type TaskPriority } from "@/hooks/useTaskData";
import { supabase } from "@/integrations/supabase/client";
import { PriorityBadge } from "@/components/PriorityBadge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
}

interface TaskPreview {
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string;
  duration_hours?: number;
  collection_id?: string;
  column_id?: string;
  assignee_id?: string;
  project_id?: string;
  subtasks?: string[];
  _editing?: boolean;
  _removed?: boolean;
  _created?: boolean;
}

interface ProjectPreview {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  _created?: boolean;
  _createdId?: string;
}

interface RequestPreview {
  to_user_id?: string;
  task_title: string;
  task_description?: string;
  suggested_due_date?: string;
  impediment_id?: string;
}

interface TaskUpdatePreview {
  task_id: string;
  current_title?: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  duration_hours?: number;
  assignee_id?: string;
  is_done?: boolean;
}

interface ScheduleDay {
  work_date: string;
  start_hour: number;
  hours: number;
}

interface ScheduleSetPreview {
  task_id: string;
  current_title?: string;
  days: ScheduleDay[];
}

interface PendingAction {
  type: "create_tasks" | "register_impediment" | "create_request" | "create_project" | "update_tasks" | "set_task_schedule";
  data: any;
  previews?: TaskPreview[];
  projectPreview?: ProjectPreview;
  requestPreview?: RequestPreview;
  updatePreviews?: TaskUpdatePreview[];
  schedulePreviews?: ScheduleSetPreview[];
  confirmed?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PRIORITY_OPTIONS: TaskPriority[] = ["baixa", "media", "alta", "urgente"];

function TaskPreviewCard({
  task, index, collections, allColumns, profiles, projects,
  onUpdate, onRemove, onToggleEdit
}: {
  task: TaskPreview;
  index: number;
  collections: any[];
  allColumns: any[];
  profiles: any[];
  projects: any[];
  onUpdate: (index: number, updates: Partial<TaskPreview>) => void;
  onRemove: (index: number) => void;
  onToggleEdit: (index: number) => void;
}) {
  if (task._removed) return null;

  if (task._created) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex items-center gap-2.5">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-card-foreground truncate">{task.title}</h4>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Task criada com sucesso</p>
        </div>
      </div>
    );
  }

  const colsForCollection = allColumns.filter((c: any) => c.collection_id === task.collection_id);
  const collectionName = collections.find((c: any) => c.id === task.collection_id)?.name;
  const columnName = allColumns.find((c: any) => c.id === task.column_id)?.name;
  const assigneeName = profiles.find((p: any) => p.user_id === task.assignee_id)?.name;
  const projectName = projects.find((p: any) => p.id === task.project_id)?.name;
  const isProjectTask = !!task.project_id;

  if (task._editing) {
    return (
      <div className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary">Editando Task #{index + 1}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleEdit(index)}>
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Input
          value={task.title}
          onChange={(e) => onUpdate(index, { title: e.target.value })}
          placeholder="Título da task"
          className="text-sm font-medium"
        />
        <Textarea
          value={task.description || ""}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
          placeholder="Descrição (opcional)"
          rows={2}
          className="text-sm resize-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Prioridade</label>
            <Select value={task.priority} onValueChange={(v) => onUpdate(index, { priority: v as TaskPriority })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Duracao (horas)</label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onUpdate(index, { duration_hours: Math.max(0.5, (task.duration_hours || 1) - 0.5) })}>
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number" min={0.5} step={0.5}
                value={task.duration_hours || 1}
                onChange={(e) => onUpdate(index, { duration_hours: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                className="h-8 text-xs text-center w-14"
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onUpdate(index, { duration_hours: (task.duration_hours || 1) + 0.5 })}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Prazo</label>
            <Input
              type="date"
              value={task.due_date || ""}
              onChange={(e) => onUpdate(index, { due_date: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Coleção</label>
            <Select value={task.collection_id || ""} onValueChange={(v) => {
              const firstCol = allColumns.find((c: any) => c.collection_id === v);
              onUpdate(index, { collection_id: v, column_id: firstCol?.id });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {collections.map((c: any) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Coluna</label>
            <Select value={task.column_id || ""} onValueChange={(v) => onUpdate(index, { column_id: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {colsForCollection.map((c: any) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Responsável</label>
          <Select value={task.assignee_id || "none"} onValueChange={(v) => onUpdate(index, { assignee_id: v === "none" ? undefined : v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Sem responsável</SelectItem>
              {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {task.subtasks && task.subtasks.length > 0 && (
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Subtasks</label>
            {task.subtasks.map((s, j) => (
              <div key={j} className="flex items-center gap-1 mb-1">
                <Input
                  value={s}
                  onChange={(e) => {
                    const newSubs = [...task.subtasks!];
                    newSubs[j] = e.target.value;
                    onUpdate(index, { subtasks: newSubs });
                  }}
                  className="h-7 text-xs flex-1"
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                  const newSubs = task.subtasks!.filter((_, k) => k !== j);
                  onUpdate(index, { subtasks: newSubs });
                }}>
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
              onUpdate(index, { subtasks: [...(task.subtasks || []), ""] });
            }}>
              <Plus className="h-3 w-3" /> Adicionar subtask
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Read-only preview card
  return (
    <div className="rounded-xl border bg-card p-3.5 space-y-2 shadow-sm hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-card-foreground leading-snug">{task.title}</h4>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleEdit(index)}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(index)}>
            <X className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <PriorityBadge priority={task.priority} />
        {task.duration_hours && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.duration_hours}h
          </span>
        )}
        {task.due_date && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(task.due_date + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {collectionName && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <FolderOpen className="h-3 w-3" />
            {collectionName}{columnName ? ` › ${columnName}` : ""}
          </span>
        )}
        {assigneeName && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
            {assigneeName}
          </span>
        )}
        {projectName && (
          <span className="flex items-center gap-1 text-primary">
            <GanttChart className="h-3 w-3" />
            {projectName}
          </span>
        )}
      </div>
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="pl-1 space-y-0.5">
          <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Subtasks:
          </span>
          {task.subtasks.map((s, j) => (
            <p key={j} className="text-[11px] text-muted-foreground pl-4">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectPreviewCard({
  preview, onUpdate
}: {
  preview: ProjectPreview;
  onUpdate: (updates: Partial<ProjectPreview>) => void;
}) {
  if (preview._created) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex items-center gap-2.5">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-card-foreground truncate">{preview.name}</h4>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Projeto criado com sucesso</p>
        </div>
      </div>
    );
  }

  const days = Math.ceil((new Date(preview.end_date).getTime() - new Date(preview.start_date).getTime()) / 86400000) + 1;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <GanttChart className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Novo Projeto</h4>
      </div>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Nome</label>
          <Input
            value={preview.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Descrição</label>
          <Textarea
            value={preview.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            className="text-xs resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Início</label>
            <Input
              type="date"
              value={preview.start_date}
              onChange={(e) => onUpdate({ start_date: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Fim</label>
            <Input
              type="date"
              value={preview.end_date}
              onChange={(e) => onUpdate({ end_date: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Duração: {days} dias</p>
      </div>
    </div>
  );
}

function RequestPreviewCard({
  preview, profiles,
  onUpdate
}: {
  preview: RequestPreview;
  profiles: any[];
  onUpdate: (updates: Partial<RequestPreview>) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Nova Solicitação</h4>
      </div>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Título da task solicitada</label>
          <Input
            value={preview.task_title}
            onChange={(e) => onUpdate({ task_title: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Descrição</label>
          <Textarea
            value={preview.task_description || ""}
            onChange={(e) => onUpdate({ task_description: e.target.value })}
            rows={2}
            className="text-xs resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Destinatário</label>
            <Select value={preview.to_user_id || "none"} onValueChange={(v) => onUpdate({ to_user_id: v === "none" ? undefined : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Não definido</SelectItem>
                {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Prazo sugerido</label>
            <Input
              type="date"
              value={preview.suggested_due_date || ""}
              onChange={(e) => onUpdate({ suggested_due_date: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { data: collections } = useCollections();
  const { data: profiles } = useProfiles();
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const createSubtask = useCreateSubtask();
  const createImpediment = useCreateImpediment();
  const createProject = useCreateProject();
  const updateTask = useUpdateTask();
  const { data: allTasks } = useAllTasks();

  // Fetch all columns for dropdown
  const [allColumns, setAllColumns] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("columns").select("*").order("position").then(({ data }) => {
      if (data) setAllColumns(data);
    });
  }, [collections]);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    supabase.from("chat_conversations").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setConversations(data); });
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId || !user) {
      setMessages([{ id: "welcome", role: "assistant", content: "Olá! 👋 Sou a IA do TaskAI. Posso criar tasks, projetos, registrar impedimentos e gerar solicitações. Como posso te ajudar?" }]);
      return;
    }
    supabase.from("chat_messages").select("*").eq("conversation_id", activeConversationId).order("created_at")
      .then(({ data }) => {
        if (data?.length) {
          setMessages(data.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
        } else {
          setMessages([{ id: "welcome", role: "assistant", content: "Olá! 👋 Continue nossa conversa." }]);
        }
      });
  }, [activeConversationId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingAction]);

  const createNewConversation = async () => {
    if (!user || !profile?.workspace_id) return null;
    const { data, error } = await supabase.from("chat_conversations").insert({
      user_id: user.id,
      workspace_id: profile.workspace_id,
      title: "Nova conversa",
    }).select().single();
    if (error || !data) return null;
    setConversations(prev => [data, ...prev]);
    return data.id;
  };

  const saveMessage = async (conversationId: string, role: string, content: string) => {
    if (!user || !profile?.workspace_id) return;
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      workspace_id: profile.workspace_id,
      conversation_id: conversationId,
      role,
      content,
    });
  };

  const updateConversationTitle = async (conversationId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "");
    await supabase.from("chat_conversations").update({ title }).eq("id", conversationId);
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title } : c));
  };

  const handleNewChat = async () => {
    const convId = await createNewConversation();
    if (convId) setActiveConversationId(convId);
    setMessages([{ id: "welcome", role: "assistant", content: "Olá! 👋 Nova conversa iniciada. Como posso te ajudar?" }]);
    setPendingAction(null);
  };

  const handleDeleteConversation = async (convId: string) => {
    await supabase.from("chat_conversations").delete().eq("id", convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConversationId === convId) {
      setActiveConversationId(null);
      setMessages([{ id: "welcome", role: "assistant", content: "Olá! 👋 Sou a IA do TaskAI. Como posso te ajudar?" }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let convId = activeConversationId;
    const isFirstMessage = !convId;
    if (!convId) {
      convId = await createNewConversation();
      if (!convId) { toast.error("Erro ao criar conversa"); return; }
      setActiveConversationId(convId);
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setPendingAction(null);

    await saveMessage(convId, "user", input);
    if (isFirstMessage) await updateConversationTitle(convId, input);

    let assistantContent = "";
    const allMessages = [...messages, userMsg].filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) throw new Error("Limite de requisições excedido. Aguarde um momento.");
        if (resp.status === 402) throw new Error("Créditos insuficientes. Adicione fundos nas configurações.");
        throw new Error(errData.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolCallName = "";
      let toolCallArgs = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantContent += delta.content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id !== "welcome") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: assistantContent }];
              });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) toolCallName = tc.function.name;
                if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
              }
            }
          } catch { /* partial */ }
        }
      }

      if (assistantContent) {
        await saveMessage(convId, "assistant", assistantContent);
      }

      if (toolCallName && toolCallArgs) {
        try {
          const data = JSON.parse(toolCallArgs);
          if (toolCallName === "create_tasks" && data.tasks) {
            const defaultCol = collections?.[0];
            const defaultColumnId = allColumns.find(c => c.collection_id === defaultCol?.id)?.id;
            const previews: TaskPreview[] = data.tasks.map((t: any) => ({
              title: t.title || "",
              description: t.description,
              priority: (t.priority || "media") as TaskPriority,
              due_date: t.due_date,
              duration_hours: t.duration_hours || 1,
              collection_id: t.collection_id || defaultCol?.id,
              column_id: t.column_id || defaultColumnId,
              assignee_id: t.assignee_id,
              project_id: t.project_id,
              subtasks: t.subtasks,
              _editing: false,
              _removed: false,
              _created: false,
            }));
            setPendingAction({ type: "create_tasks", data, previews });
          } else if (toolCallName === "create_project") {
            setPendingAction({
              type: "create_project",
              data,
              projectPreview: {
                name: data.name || "",
                description: data.description,
                start_date: data.start_date || "",
                end_date: data.end_date || "",
              },
            });
          } else if (toolCallName === "register_impediment") {
            setPendingAction({ type: "register_impediment", data });
          } else if (toolCallName === "create_request") {
            setPendingAction({
              type: "create_request",
              data,
              requestPreview: {
                to_user_id: data.to_user_id,
                task_title: data.task_title || "",
                task_description: data.task_description,
                suggested_due_date: data.suggested_due_date,
                impediment_id: data.impediment_id,
              },
            });
          } else if (toolCallName === "update_tasks" && Array.isArray(data.updates)) {
            const updatePreviews: TaskUpdatePreview[] = data.updates.map((u: any) => {
              const existing = allTasks?.find((t: any) => t.id === u.task_id);
              return {
                task_id: u.task_id,
                current_title: existing?.title,
                title: u.title,
                description: u.description,
                priority: u.priority as TaskPriority | undefined,
                due_date: u.due_date,
                duration_hours: u.duration_hours,
                assignee_id: u.assignee_id,
                is_done: u.is_done,
              };
            });
            setPendingAction({ type: "update_tasks", data, updatePreviews });
          } else if (toolCallName === "set_task_schedule" && Array.isArray(data.schedules)) {
            const schedulePreviews: ScheduleSetPreview[] = data.schedules.map((s: any) => {
              const existing = allTasks?.find((t: any) => t.id === s.task_id);
              return {
                task_id: s.task_id,
                current_title: existing?.title,
                days: Array.isArray(s.days) ? s.days.map((d: any) => ({
                  work_date: d.work_date,
                  start_hour: Number(d.start_hour) || 9,
                  hours: Number(d.hours) || 0,
                })) : [],
              };
            });
            setPendingAction({ type: "set_task_schedule", data, schedulePreviews });
          }
        } catch { /* parse error */ }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao conectar com a IA");
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePreview = useCallback((index: number, updates: Partial<TaskPreview>) => {
    setPendingAction(prev => {
      if (!prev?.previews) return prev;
      const newPreviews = [...prev.previews];
      newPreviews[index] = { ...newPreviews[index], ...updates };
      return { ...prev, previews: newPreviews };
    });
  }, []);

  const handleRemovePreview = useCallback((index: number) => {
    setPendingAction(prev => {
      if (!prev?.previews) return prev;
      const newPreviews = [...prev.previews];
      newPreviews[index] = { ...newPreviews[index], _removed: true };
      return { ...prev, previews: newPreviews };
    });
  }, []);

  const handleToggleEdit = useCallback((index: number) => {
    setPendingAction(prev => {
      if (!prev?.previews) return prev;
      const newPreviews = [...prev.previews];
      newPreviews[index] = { ...newPreviews[index], _editing: !newPreviews[index]._editing };
      return { ...prev, previews: newPreviews };
    });
  }, []);

  const handleAddPreview = useCallback(() => {
    setPendingAction(prev => {
      if (!prev?.previews) return prev;
      const defaultCol = collections?.[0];
      const defaultColumnId = allColumns.find(c => c.collection_id === defaultCol?.id)?.id;
      // Check if existing previews have a project_id
      const existingProjectId = prev.previews.find(p => p.project_id)?.project_id;
      const newTask: TaskPreview = {
        title: "",
        priority: "media",
        collection_id: defaultCol?.id,
        column_id: defaultColumnId,
        project_id: existingProjectId,
        duration_hours: 1,
        _editing: true,
        _removed: false,
        _created: false,
      };
      return { ...prev, previews: [...prev.previews, newTask] };
    });
  }, [collections, allColumns]);

  const handleUpdateRequestPreview = useCallback((updates: Partial<RequestPreview>) => {
    setPendingAction(prev => {
      if (!prev?.requestPreview) return prev;
      return { ...prev, requestPreview: { ...prev.requestPreview, ...updates } };
    });
  }, []);

  const handleUpdateProjectPreview = useCallback((updates: Partial<ProjectPreview>) => {
    setPendingAction(prev => {
      if (!prev?.projectPreview) return prev;
      return { ...prev, projectPreview: { ...prev.projectPreview, ...updates } };
    });
  }, []);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.type === "create_project" && pendingAction.projectPreview) {
      const pp = pendingAction.projectPreview;
      if (!pp.name.trim() || !pp.start_date || !pp.end_date) {
        toast.error("Nome e datas são obrigatórios");
        return;
      }
      try {
        const created = await createProject.mutateAsync({
          name: pp.name,
          description: pp.description || null,
          start_date: pp.start_date,
          end_date: pp.end_date,
        });
        toast.success("Projeto criado!");
        setPendingAction({
          ...pendingAction,
          projectPreview: { ...pp, _created: true, _createdId: created.id },
          confirmed: true,
        });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: `📁 Projeto **"${pp.name}"** criado com sucesso! (${pp.start_date} → ${pp.end_date})\n\nDeseja adicionar tasks a esse projeto?`,
        }]);
      } catch {
        toast.error("Erro ao criar projeto");
      }
      return;
    }

    if (pendingAction.type === "create_tasks" && pendingAction.previews) {
      const activePreviews = pendingAction.previews.filter(p => !p._removed && !p._created && p.title.trim());
      if (!activePreviews.length) { toast.error("Nenhuma task para criar"); return; }

      let count = 0;
      const newPreviews = [...pendingAction.previews];
      for (let i = 0; i < newPreviews.length; i++) {
        const pt = newPreviews[i];
        if (pt._removed || pt._created || !pt.title.trim()) continue;

        const collId = pt.collection_id || collections?.[0]?.id;
        if (!collId) continue;
        let colId = pt.column_id;
        if (!colId) {
          const firstCol = allColumns.find(c => c.collection_id === collId);
          colId = firstCol?.id;
        }
        if (!colId) continue;

        const taskData: any = {
          title: pt.title,
          description: pt.description,
          priority: pt.priority,
          column_id: colId,
          collection_id: collId,
          assignee_id: pt.assignee_id,
        };

        if (pt.project_id) taskData.project_id = pt.project_id;
        if (pt.due_date) taskData.due_date = pt.due_date;
        if (pt.duration_hours) taskData.duration_hours = pt.duration_hours;

        const created = await createTask.mutateAsync(taskData);

        if (pt.subtasks?.length && created?.id) {
          for (let j = 0; j < pt.subtasks.length; j++) {
            if (pt.subtasks[j].trim()) {
              await createSubtask.mutateAsync({ task_id: created.id, title: pt.subtasks[j], position: j });
            }
          }
        }
        newPreviews[i] = { ...pt, _created: true };
        count++;
      }
      toast.success(`${count} task(s) criada(s)!`);
      setPendingAction({ ...pendingAction, previews: newPreviews, confirmed: true });
    }

    if (pendingAction.type === "register_impediment") {
      const d = pendingAction.data;
      const result = await createImpediment.mutateAsync({ task_id: d.task_id, description: d.description });
      const impedimentId = (result as any)?.id;
      toast.success("Impedimento registrado!");

      if (d.suggest_request) {
        const targetUser = profiles?.find((p: any) => p.name === d.request_to_user_name);
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: `⚠️ Impedimento registrado na task "${d.task_title || ''}". Deseja criar uma solicitação?`
        }]);
        setPendingAction({
          type: "create_request",
          data: {},
          requestPreview: {
            to_user_id: targetUser?.user_id,
            task_title: d.request_task_title || `Resolver: ${d.description?.slice(0, 50) || "impedimento"}`,
            task_description: d.description,
            impediment_id: impedimentId,
          },
        });
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: `⚠️ Impedimento registrado na task "${d.task_title || ''}".` }]);
        setPendingAction(null);
      }
    }

    if (pendingAction.type === "create_request") {
      const rp = pendingAction.requestPreview;
      if (!rp?.task_title?.trim()) { toast.error("Título da solicitação é obrigatório"); return; }
      const { error } = await supabase.from("requests").insert({
        from_user_id: user!.id,
        to_user_id: rp.to_user_id || null,
        task_title: rp.task_title,
        task_description: rp.task_description,
        suggested_due_date: rp.suggested_due_date,
        impediment_id: rp.impediment_id || null,
      });
      if (error) toast.error("Erro ao criar solicitação");
      else {
        const targetName = profiles?.find((p: any) => p.user_id === rp.to_user_id)?.name;
        toast.success("Solicitação criada!");
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: `📩 Solicitação "${rp.task_title}" enviada${targetName ? ` para ${targetName}` : ""}!`
        }]);
      }
      setPendingAction(null);
    }

    if (pendingAction.type === "update_tasks" && pendingAction.updatePreviews) {
      let count = 0;
      for (const u of pendingAction.updatePreviews) {
        if (!u.task_id) continue;
        const updates: any = {};
        if (u.title !== undefined) updates.title = u.title;
        if (u.description !== undefined) updates.description = u.description;
        if (u.priority !== undefined) updates.priority = u.priority;
        if (u.due_date !== undefined) updates.due_date = u.due_date === "" ? null : u.due_date;
        if (u.duration_hours !== undefined) updates.duration_hours = u.duration_hours;
        if (u.assignee_id !== undefined) updates.assignee_id = u.assignee_id;
        if (u.is_done !== undefined) updates.is_done = u.is_done;
        if (Object.keys(updates).length === 0) continue;
        try {
          await updateTask.mutateAsync({ id: u.task_id, ...updates });
          count++;
        } catch (e) {
          console.error("update_tasks error", e);
        }
      }
      toast.success(`${count} task(s) atualizada(s)!`);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: `✅ ${count} task(s) atualizada(s) com sucesso!`,
      }]);
      setPendingAction(null);
    }

    if (pendingAction.type === "set_task_schedule" && pendingAction.schedulePreviews) {
      let count = 0;
      for (const s of pendingAction.schedulePreviews) {
        if (!s.task_id) continue;
        try {
          // Replace existing overrides for this task
          await supabase.from("task_schedule_overrides").delete().eq("task_id", s.task_id);
          const validDays = s.days.filter(d => d.work_date && d.hours > 0);
          if (validDays.length > 0) {
            const { error } = await supabase.from("task_schedule_overrides").insert(
              validDays.map(d => ({
                task_id: s.task_id,
                work_date: d.work_date,
                start_hour: d.start_hour,
                hours: d.hours,
              })),
            );
            if (error) throw error;
          }
          count++;
        } catch (e) {
          console.error("set_task_schedule error", e);
        }
      }
      toast.success(`Agenda de ${count} task(s) atualizada!`);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: `📅 Reagendamento aplicado em ${count} task(s).`,
      }]);
      setPendingAction(null);
    }
  };

  const activePreviewCount = pendingAction?.previews?.filter(p => !p._removed && !p._created).length || 0;
  const allCreated = pendingAction?.confirmed && activePreviewCount === 0;

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Sidebar: conversation history */}
        <div className="w-64 shrink-0 border-r flex flex-col bg-card">
          <div className="p-3 border-b">
            <Button size="sm" className="w-full gap-1.5" onClick={handleNewChat}>
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  activeConversationId === conv.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setActiveConversationId(conv.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{conv.title}</span>
                <Button
                  variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conversa ainda</p>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2 border-b px-6 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h1 className="font-heading text-lg font-semibold">Chat IA</h1>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}

            {/* Project preview card */}
            {pendingAction?.type === "create_project" && pendingAction.projectPreview && (
              <div className="space-y-3">
                <ProjectPreviewCard
                  preview={pendingAction.projectPreview}
                  onUpdate={handleUpdateProjectPreview}
                />
                {!pendingAction.confirmed && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConfirmAction} className="gap-1" disabled={!pendingAction.projectPreview.name.trim()}>
                      <Check className="h-3.5 w-3.5" /> Criar Projeto
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
                  </div>
                )}
              </div>
            )}

            {/* Task preview cards */}
            {pendingAction?.type === "create_tasks" && pendingAction.previews && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {allCreated
                      ? "Tasks criadas:"
                      : activePreviewCount === 1 ? "Task sugerida:" : `${activePreviewCount} tasks sugeridas:`}
                  </p>
                  {!allCreated && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleAddPreview}>
                      <Plus className="h-3 w-3" /> Adicionar task
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {pendingAction.previews.map((task, i) => (
                    <TaskPreviewCard
                      key={i}
                      task={task}
                      index={i}
                      collections={collections || []}
                      allColumns={allColumns}
                      profiles={profiles || []}
                      projects={projects || []}
                      onUpdate={handleUpdatePreview}
                      onRemove={handleRemovePreview}
                      onToggleEdit={handleToggleEdit}
                    />
                  ))}
                </div>
                {!allCreated && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConfirmAction} className="gap-1.5" disabled={activePreviewCount === 0}>
                      <Check className="h-3.5 w-3.5" />
                      {activePreviewCount === 1 ? "Criar Task" : `Criar Todas (${activePreviewCount})`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
                  </div>
                )}
              </div>
            )}

            {/* Impediment preview */}
            {pendingAction?.type === "register_impediment" && (
              <div className="space-y-2">
                <div className="rounded-xl border border-status-attention/30 bg-status-attention/5 p-3.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-status-attention" />
                    <h4 className="text-sm font-semibold text-card-foreground">Registrar Impedimento</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{pendingAction.data.description}</p>
                  {pendingAction.data.task_title && (
                    <p className="text-[11px] text-muted-foreground">Task: <span className="font-medium text-foreground">{pendingAction.data.task_title}</span></p>
                  )}
                  {pendingAction.data.suggest_request && (
                    <p className="text-[11px] text-primary mt-1">→ Após confirmar, será sugerida uma solicitação</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmAction} className="gap-1"><Check className="h-3.5 w-3.5" /> Confirmar</Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Request preview — editable */}
            {pendingAction?.type === "create_request" && pendingAction.requestPreview && (
              <div className="space-y-2">
                <RequestPreviewCard
                  preview={pendingAction.requestPreview}
                  profiles={profiles || []}
                  onUpdate={handleUpdateRequestPreview}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmAction} className="gap-1"><Check className="h-3.5 w-3.5" /> Enviar Solicitação</Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Update tasks preview */}
            {pendingAction?.type === "update_tasks" && pendingAction.updatePreviews && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Alterações sugeridas em {pendingAction.updatePreviews.length} task(s):
                </p>
                <div className="space-y-2">
                  {pendingAction.updatePreviews.map((u, i) => {
                    const profileName = profiles?.find((p: any) => p.user_id === u.assignee_id)?.name;
                    const changes: string[] = [];
                    if (u.title !== undefined) changes.push(`título → ${u.title}`);
                    if (u.priority !== undefined) changes.push(`prioridade → ${u.priority}`);
                    if (u.due_date !== undefined) changes.push(`prazo → ${u.due_date || "removido"}`);
                    if (u.duration_hours !== undefined) changes.push(`duração → ${u.duration_hours}h`);
                    if (u.assignee_id !== undefined) changes.push(`responsável → ${profileName || u.assignee_id}`);
                    if (u.is_done !== undefined) changes.push(u.is_done ? "marcar concluída" : "reabrir");
                    return (
                      <div key={i} className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
                          <h4 className="text-sm font-semibold text-card-foreground truncate">{u.current_title || u.task_id}</h4>
                        </div>
                        <ul className="text-[11px] text-muted-foreground pl-5 list-disc space-y-0.5">
                          {changes.map((c, j) => <li key={j}>{c}</li>)}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmAction} className="gap-1"><Check className="h-3.5 w-3.5" /> Aplicar alterações</Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Set task schedule preview */}
            {pendingAction?.type === "set_task_schedule" && pendingAction.schedulePreviews && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Reagendamento sugerido para {pendingAction.schedulePreviews.length} task(s):
                </p>
                <div className="space-y-2">
                  {pendingAction.schedulePreviews.map((s, i) => {
                    const totalHours = s.days.reduce((sum, d) => sum + d.hours, 0);
                    return (
                      <div key={i} className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                          <h4 className="text-sm font-semibold text-card-foreground truncate flex-1">{s.current_title || s.task_id}</h4>
                          <span className="text-[10px] text-muted-foreground">{totalHours}h total</span>
                        </div>
                        <ul className="text-[11px] text-muted-foreground pl-5 list-disc space-y-0.5">
                          {s.days.map((d, j) => (
                            <li key={j}>
                              {d.work_date} — {d.hours}h às {d.start_hour}h
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmAction} className="gap-1"><Check className="h-3.5 w-3.5" /> Aplicar agenda</Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
                </div>
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Cria um projeto, adiciona tasks ao projeto, registra impedimento..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={isLoading}
              />
              <Button size="icon" onClick={handleSend} disabled={isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
