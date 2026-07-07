import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TaskPriority = "baixa" | "media" | "alta" | "urgente";

export interface Task {
  id: string;
  list_id: string;
  parent_task_id: string | null;
  status_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  due_time: string | null;
  assignee_id: string | null;
  priority: TaskPriority;
  position: number;
  is_done: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  list_id: string;
  name: string;
  color: string;
  type: "todo" | "active" | "done";
  position: number;
}

export interface ListDetail {
  id: string;
  name: string;
  color: string | null;
  space_id: string;
  folder_id: string | null;
  space_name: string;
  folder_name: string | null;
}

export interface CustomField {
  id: string;
  list_id: string;
  name: string;
  type: "text" | "number" | "select" | "date" | "checkbox" | "user" | "url" | "email";
  options: unknown[];
  position: number;
  is_visible: boolean;
}

export function useList(listId: string | undefined) {
  return useQuery<ListDetail | null>({
    queryKey: ["list", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("id, name, color, space_id, folder_id, spaces(name), folders(name)")
        .eq("id", listId!)
        .single();
      if (error) throw error;
      const row = data as any;
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        space_id: row.space_id,
        folder_id: row.folder_id,
        space_name: row.spaces?.name || "",
        folder_name: row.folders?.name || null,
      };
    },
  });
}

export function useStatuses(listId: string | undefined) {
  return useQuery<Status[]>({
    queryKey: ["statuses", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase.from("statuses").select("*").eq("list_id", listId!).order("position");
      if (error) throw error;
      return (data as Status[]) || [];
    },
  });
}

export function useTasks(listId: string | undefined) {
  return useQuery<Task[]>({
    queryKey: ["tasks", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("list_id", listId!)
        .order("position");
      if (error) throw error;
      return (data as Task[]) || [];
    },
  });
}

export function useCustomFields(listId: string | undefined) {
  return useQuery<CustomField[]>({
    queryKey: ["custom-fields", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_fields").select("*").eq("list_id", listId!).order("position");
      if (error) throw error;
      return (data as CustomField[]) || [];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Task> & { list_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...input,
          created_by: user?.id,
          start_date: input.start_date ?? new Date().toISOString().slice(0, 10),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", vars.list_id] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d: any) => {
      if (_d?.list_id) qc.invalidateQueries({ queryKey: ["tasks", _d.list_id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; list_id: string }) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", vars.list_id] });
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name, email, avatar_url");
      if (error) throw error;
      return data || [];
    },
  });
}
