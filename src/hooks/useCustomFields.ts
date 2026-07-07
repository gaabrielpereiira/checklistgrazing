import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CustomFieldType = "text" | "number" | "select" | "date" | "checkbox" | "user" | "url" | "email";

export interface CustomField {
  id: string;
  list_id: string;
  name: string;
  type: CustomFieldType;
  options: Array<{ label: string; value: string; color?: string }>;
  position: number;
  is_visible: boolean;
  width: number | null;
}

export function useCustomFields(listId: string | undefined) {
  return useQuery<CustomField[]>({
    queryKey: ["custom-fields", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_fields").select("*").eq("list_id", listId!).order("position");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { list_id: string; name: string; type: CustomFieldType; options?: any[] }) => {
      const { data: existing } = await supabase.from("custom_fields").select("position").eq("list_id", input.list_id).order("position", { ascending: false }).limit(1);
      const nextPos = (existing?.[0]?.position ?? -1) + 1;
      const { data, error } = await supabase.from("custom_fields").insert({
        list_id: input.list_id, name: input.name, type: input.type, options: input.options || [], position: nextPos,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["custom-fields", v.list_id] }),
  });
}

export function useUpdateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, list_id }: { id: string; list_id: string; patch: Partial<CustomField> }) => {
      const { error } = await supabase.from("custom_fields").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["custom-fields", v.list_id] }),
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; list_id: string }) => {
      const { error } = await supabase.from("custom_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["custom-fields", v.list_id] }),
  });
}

export interface FieldValue { id: string; task_id: string; field_id: string; value: any }

export function useFieldValues(listId: string | undefined) {
  return useQuery<Record<string, Record<string, any>>>({
    queryKey: ["field-values", listId],
    enabled: !!listId,
    queryFn: async () => {
      if (!listId) return {};
      const { data: fields } = await supabase.from("custom_fields").select("id").eq("list_id", listId);
      const fieldIds = (fields || []).map((f: any) => f.id);
      if (fieldIds.length === 0) return {};
      const { data, error } = await supabase.from("task_field_values").select("*").in("field_id", fieldIds);
      if (error) throw error;
      const map: Record<string, Record<string, any>> = {};
      (data || []).forEach((row: any) => {
        (map[row.task_id] ||= {})[row.field_id] = row.value;
      });
      return map;
    },
  });
}

export function useUpsertFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task_id, field_id, value, list_id }: { task_id: string; field_id: string; value: any; list_id: string }) => {
      const { error } = await supabase.from("task_field_values").upsert({ task_id, field_id, value }, { onConflict: "task_id,field_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["field-values", v.list_id] }),
  });
}

// ============ list_views ============
export interface SavedView {
  id: string;
  list_id: string;
  name: string;
  type: "list" | "kanban" | "calendar" | "gantt";
  config: any;
  is_shared: boolean;
  position: number;
  owner_id: string | null;
}

export function useSavedViews(listId: string | undefined) {
  return useQuery<SavedView[]>({
    queryKey: ["list-views", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase.from("list_views").select("*").eq("list_id", listId!).order("position");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useSaveView() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id?: string; list_id: string; name: string; type: SavedView["type"]; config: any; is_shared?: boolean }) => {
      if (id) {
        const { error } = await supabase.from("list_views").update({ name: input.name, config: input.config, is_shared: input.is_shared ?? true }).eq("id", id);
        if (error) throw error;
        return { id };
      } else {
        const { data, error } = await supabase.from("list_views").insert({
          list_id: input.list_id, name: input.name, type: input.type, config: input.config, is_shared: input.is_shared ?? true, owner_id: user?.id,
        }).select().single();
        if (error) throw error;
        return data as any;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["list-views", v.list_id] }),
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; list_id: string }) => {
      const { error } = await supabase.from("list_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["list-views", v.list_id] }),
  });
}
