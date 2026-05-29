import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Collection = Database["public"]["Tables"]["collections"]["Row"];
type Column = Database["public"]["Tables"]["columns"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
type Impediment = Database["public"]["Tables"]["impediments"]["Row"];
type Request = Database["public"]["Tables"]["requests"]["Row"];
type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

export type { Collection, Column, Task, Subtask, Impediment, Request, Notification, TaskPriority, RequestStatus };

export type FullTask = Task & { subtasks: Subtask[]; impediments: Impediment[] };
export type FullTaskWithCollection = FullTask & { collections: { name: string } | null };

// ─── Column Connection type ───
export type AssigneeConfig =
  | { mode: "none" }
  | { mode: "fixed"; user_id: string }
  | { mode: "choose"; candidates: string[] }
  | null;

export interface ColumnConnection {
  id: string;
  source_column_id: string;
  target_column_id: string;
  created_at: string;
  time_options: number[] | null;
  assignee_config: AssigneeConfig;
}

// ─── Sector type ───
export interface Sector {
  id: string;
  name: string;
  workspace_id: string;
  created_at: string;
}

// ─── Profile with sector ───
export interface ProfileWithSector {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  workspace_id: string | null;
  avatar_url: string | null;
  sector_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Collections ───
export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collections").select("*").order("created_at");
      if (error) throw error;
      return data as Collection[];
    },
  });
}

export function useColumns(collectionId: string | null) {
  return useQuery({
    queryKey: ["columns", collectionId],
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("columns").select("*").eq("collection_id", collectionId!).order("position");
      if (error) throw error;
      return data as Column[];
    },
  });
}

export function useAllColumns() {
  return useQuery({
    queryKey: ["all-columns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("columns").select("*, collections(name)").order("position");
      if (error) throw error;
      return data as (Column & { collections: { name: string } | null })[];
    },
  });
}

// ─── Tasks ───
export function useTasks(collectionId: string | null) {
  return useQuery({
    queryKey: ["tasks", collectionId],
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, subtasks(*), impediments(*)")
        .eq("collection_id", collectionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FullTask[];
    },
  });
}

export function useAllTasks() {
  return useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, subtasks(*), impediments(*), collections(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FullTaskWithCollection[];
    },
  });
}

// ─── Profiles ───
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data as ProfileWithSector[];
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; phone?: string | null; sector_id?: string | null; slack_user_id?: string | null; notification_preferences?: Record<string, string> }) => {
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

// ─── Collections CRUD ───
export function useCreateCollectionWithColumns() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ name, columns, color }: { name: string; columns: string[]; color?: string }) => {
      const { data, error } = await supabase
        .from("collections")
        .insert({ name, workspace_id: profile!.workspace_id!, created_by: user!.id, ...(color ? { color } : {}) } as any)
        .select().single();
      if (error) throw error;
      // Create columns in order
      const colInserts = columns.map((colName, idx) => ({
        name: colName,
        collection_id: data.id,
        position: idx,
      }));
      const { error: colErr } = await supabase.from("columns").insert(colInserts);
      if (colErr) throw colErr;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["all-columns"] });
    },
  });
}

// Keep simple version for backward compat
export function useCreateCollection() {
  const createFull = useCreateCollectionWithColumns();
  return {
    ...createFull,
    mutate: (name: string) => createFull.mutate({ name, columns: ["A Fazer", "Em Progresso", "Concluído"] }),
    mutateAsync: (name: string) => createFull.mutateAsync({ name, columns: ["A Fazer", "Em Progresso", "Concluído"] }),
  };
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete subtasks of tasks in this collection
      const { data: taskIds } = await supabase.from("tasks").select("id").eq("collection_id", id);
      if (taskIds && taskIds.length > 0) {
        const ids = taskIds.map(t => t.id);
        await supabase.from("subtasks").delete().in("task_id", ids);
        await supabase.from("impediments").delete().in("task_id", ids);
      }
      // Delete tasks
      await supabase.from("tasks").delete().eq("collection_id", id);
      // Delete column connections for columns in this collection
      const { data: colIds } = await supabase.from("columns").select("id").eq("collection_id", id);
      if (colIds && colIds.length > 0) {
        const ids = colIds.map(c => c.id);
        await supabase.from("column_connections").delete().in("source_column_id", ids);
        await supabase.from("column_connections").delete().in("target_column_id", ids);
      }
      // Delete columns
      await supabase.from("columns").delete().eq("collection_id", id);
      // Delete collection
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["columns"] });
      qc.invalidateQueries({ queryKey: ["all-columns"] });
      qc.invalidateQueries({ queryKey: ["column-connections"] });
    },
  });
}

export function useArchiveCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").update({ is_archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useSaveLastCollection() {
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (collectionId: string) => {
      if (!profile) return;
      await supabase.from("profiles").update({ last_collection_id: collectionId } as any).eq("id", profile.id);
    },
  });
}

export function useCreateColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, collection_id, position }: { name: string; collection_id: string; position: number }) => {
      const { data, error } = await supabase.from("columns").insert({ name, collection_id, position }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["columns", vars.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-columns"] });
    },
  });
}

export function useUpdateColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Column> & { id: string }) => {
      const { data, error } = await supabase.from("columns").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["columns", data.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-columns"] });
    },
  });
}

export function useDeleteColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collection_id, moveTasksTo }: { id: string; collection_id: string; moveTasksTo: string | null }) => {
      // Move tasks if needed
      if (moveTasksTo) {
        await supabase.from("tasks").update({ column_id: moveTasksTo }).eq("column_id", id);
      }
      // Delete connections involving this column
      await supabase.from("column_connections").delete().eq("source_column_id", id);
      await supabase.from("column_connections").delete().eq("target_column_id", id);
      // Delete the column
      const { error } = await supabase.from("columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["columns", vars.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-columns"] });
      qc.invalidateQueries({ queryKey: ["tasks", vars.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["column-connections"] });
    },
  });
}

export function useReorderColumns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ columns, collection_id }: { columns: { id: string; position: number }[]; collection_id: string }) => {
      await Promise.all(
        columns.map(col => supabase.from("columns").update({ position: col.position }).eq("id", col.id))
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["columns", vars.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-columns"] });
    },
  });
}

// ─── Task CRUD ───
export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (task: { title: string; column_id: string; collection_id: string; description?: string; priority?: TaskPriority; due_date?: string; assignee_id?: string; linked_task_id?: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...task, created_by: user!.id })
        .select("*, subtasks(*), impediments(*)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks", data.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

// Shared fields that must stay in sync across linked tasks
const LINKED_SYNC_FIELDS: (keyof Task)[] = [
  "title", "description", "assignee_id", "duration_hours", "duration_days",
  "position_hour", "position_day", "priority", "project_id", "due_date",
];

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select("*, subtasks(*), impediments(*)").single();
      if (error) throw error;

      // Sync shared fields to all linked tasks (bidirectional)
      const syncFields: Record<string, unknown> = {};
      for (const key of LINKED_SYNC_FIELDS) {
        if (key in updates) {
          syncFields[key] = (updates as any)[key];
        }
      }
      if (Object.keys(syncFields).length > 0) {
        // Sync to the task this one points to
        if (data.linked_task_id) {
          await supabase.from("tasks").update(syncFields as any).eq("id", data.linked_task_id);
        }
        // Sync to tasks that point to this one
        await supabase.from("tasks").update(syncFields as any).eq("linked_task_id", id);
      }

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks", data.collection_id] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collection_id }: { id: string; collection_id: string }) => {
      // Nullify linked_task_id references pointing to this task so FK doesn't block deletion
      await supabase.from("tasks").update({ linked_task_id: null }).eq("linked_task_id", id);
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      return collection_id;
    },
    onSuccess: (collectionId) => {
      qc.invalidateQueries({ queryKey: ["tasks", collectionId] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

// ─── Subtasks ───
export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task_id, title, position }: { task_id: string; title: string; position: number }) => {
      const { data, error } = await supabase.from("subtasks").insert({ task_id, title, position }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Subtask> & { id: string }) => {
      const { data, error } = await supabase.from("subtasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

// ─── Requests ───
export function useReceivedRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["requests", "received"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("to_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
  });
}

export function useSentRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["requests", "sent"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("from_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ requestId, collectionId, columnId }: { requestId: string; collectionId: string; columnId: string }) => {
      const { data: req, error: reqError } = await supabase.from("requests").select("*").eq("id", requestId).single();
      if (reqError) throw reqError;

      const { data: task, error: taskError } = await supabase.from("tasks").insert({
        title: req.task_title,
        description: req.task_description,
        collection_id: collectionId,
        column_id: columnId,
        due_date: req.suggested_due_date,
        created_by: user!.id,
      }).select().single();
      if (taskError) throw taskError;

      const { error: updateError } = await supabase.from("requests").update({
        status: 'accepted' as RequestStatus,
        accepted_task_id: task.id,
      }).eq("id", requestId);
      if (updateError) throw updateError;

      if (req.impediment_id) {
        await supabase.from("impediments").update({ resolved_at: new Date().toISOString() }).eq("id", req.impediment_id);
      }

      return task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRefuseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase.from("requests").update({
        status: 'refused' as RequestStatus,
        refusal_reason: reason,
      }).eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Notifications ───
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
  });
}

export function useUnreadNotificationCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter(n => !n.is_read).length || 0;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ─── Impediments ───
export function useCreateImpediment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task_id, description }: { task_id: string; description: string }) => {
      const { data, error } = await supabase.from("impediments").insert({ task_id, description }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

// ─── Column Connections ───
export function useColumnConnections() {
  return useQuery({
    queryKey: ["column-connections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("column_connections").select("*");
      if (error) throw error;
      return data as ColumnConnection[];
    },
  });
}

export function useCreateColumnConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ source_column_id, target_column_id }: { source_column_id: string; target_column_id: string }) => {
      const { data, error } = await supabase.from("column_connections").insert({ source_column_id, target_column_id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["column-connections"] }),
  });
}

export function useDeleteColumnConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("column_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["column-connections"] }),
  });
}

export function useUpdateColumnConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; time_options?: number[] | null; assignee_config?: AssigneeConfig }) => {
      const { error } = await supabase.from("column_connections").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["column-connections"] }),
  });
}

// ─── Sectors ───
export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data as Sector[];
    },
  });
}

export function useCreateSector() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("sectors").insert({ name, workspace_id: profile!.workspace_id! }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sectors"] }),
  });
}

export function useDeleteSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sectors"] }),
  });
}

// ─── User Sectors (multi-sector) ───
export interface UserSector {
  id: string;
  user_id: string;
  sector_id: string;
  created_at: string;
}

export function useUserSectors() {
  return useQuery({
    queryKey: ["user-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_sectors").select("*");
      if (error) throw error;
      return data as UserSector[];
    },
  });
}

export function useAddUserSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, sector_id }: { user_id: string; sector_id: string }) => {
      const { data, error } = await supabase.from("user_sectors").insert({ user_id, sector_id } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-sectors"] }),
  });
}

export function useRemoveUserSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, sector_id }: { user_id: string; sector_id: string }) => {
      const { error } = await supabase.from("user_sectors").delete().eq("user_id", user_id).eq("sector_id", sector_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-sectors"] }),
  });
}

// ─── User Roles ───
export function useUserRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });
}

// ─── Column Automations ───
export interface ColumnAutomation {
  id: string;
  column_id: string;
  type: string;
  value: string;
  created_at: string;
}

export function useColumnAutomations() {
  return useQuery({
    queryKey: ["column-automations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("column_automations").select("*");
      if (error) throw error;
      return data as ColumnAutomation[];
    },
  });
}

export function useCreateColumnAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ column_id, type, value }: { column_id: string; type: string; value: string }) => {
      const { data, error } = await supabase.from("column_automations").insert({ column_id, type, value } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["column-automations"] }),
  });
}

export function useDeleteColumnAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("column_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["column-automations"] }),
  });
}

// ─── Teams ───
export interface Team {
  id: string;
  name: string;
  workspace_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data as Team[];
    },
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*");
      if (error) throw error;
      return data as TeamMember[];
    },
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }) => {
      const { data, error } = await supabase
        .from("teams")
        .insert({ name, workspace_id: profile!.workspace_id! })
        .select()
        .single();
      if (error) throw error;
      if (memberIds.length > 0) {
        const inserts = memberIds.map(uid => ({ team_id: data.id, user_id: uid }));
        await supabase.from("team_members").insert(inserts);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("teams").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["collection-teams"] });
    },
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
  });
}

// ─── Collection Access (Teams & Users) ───
export interface CollectionTeam {
  id: string;
  collection_id: string;
  team_id: string;
  created_at: string;
}

export interface CollectionUser {
  id: string;
  collection_id: string;
  user_id: string;
  created_at: string;
}

export function useCollectionTeams() {
  return useQuery({
    queryKey: ["collection-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_teams").select("*");
      if (error) throw error;
      return data as CollectionTeam[];
    },
  });
}

export function useCollectionUsers() {
  return useQuery({
    queryKey: ["collection-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_users").select("*");
      if (error) throw error;
      return data as CollectionUser[];
    },
  });
}

export function useAddCollectionTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, teamId }: { collectionId: string; teamId: string }) => {
      const { error } = await supabase.from("collection_teams").insert({ collection_id: collectionId, team_id: teamId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-teams"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useRemoveCollectionTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collection_teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-teams"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useAddCollectionUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, userId }: { collectionId: string; userId: string }) => {
      const { error } = await supabase.from("collection_users").insert({ collection_id: collectionId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-users"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useRemoveCollectionUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collection_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-users"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// ─── Projects ───
export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  workspace_id: string;
  created_by: string;
  created_at: string;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("start_date");
      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (project: { name: string; description: string | null; start_date: string; end_date: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...project, workspace_id: profile!.workspace_id!, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string | null; start_date?: string; end_date?: string }) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Remove project_id from tasks first
      await supabase.from("tasks").update({ project_id: null } as any).eq("project_id", id);
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

// ─── Schedule Overrides ───
export interface ScheduleOverride {
  id: string;
  task_id: string;
  work_date: string;
  start_hour: number;
  hours: number;
}

export function useScheduleOverrides() {
  return useQuery({
    queryKey: ["schedule-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_schedule_overrides" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as ScheduleOverride[];
    },
  });
}

export function useUpsertScheduleOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (overrides: { task_id: string; work_date: string; start_hour: number; hours: number }[]) => {
      if (overrides.length === 0) return;
      const { error } = await supabase
        .from("task_schedule_overrides" as any)
        .upsert(overrides, { onConflict: "task_id,work_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-overrides"] });
    },
  });
}

// ─── Task Kanban History ───
export interface TaskKanbanHistoryRecord {
  id: string;
  task_id: string;
  collection_id: string;
  column_id: string;
  entered_at: string;
  exited_at: string | null;
  time_limit_hours: number | null;
}

export function useTaskKanbanHistory() {
  return useQuery({
    queryKey: ["task-kanban-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_kanban_history" as any)
        .select("*")
        .order("entered_at", { ascending: true });
      if (error) throw error;
      return data as unknown as TaskKanbanHistoryRecord[];
    },
  });
}
