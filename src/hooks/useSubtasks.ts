import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "./useListData";
import { useAuth } from "@/contexts/AuthContext";

export function useSubtasks(parentId: string | undefined) {
  return useQuery<Task[]>({
    queryKey: ["subtasks", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("parent_task_id", parentId!).order("position");
      if (error) throw error;
      return (data as Task[]) || [];
    },
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ parent_task_id, list_id, title }: { parent_task_id: string; list_id: string; title: string }) => {
      const { data, error } = await supabase.from("tasks").insert({
        parent_task_id, list_id, title, created_by: user?.id, start_date: new Date().toISOString().slice(0, 10),
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["subtasks", v.parent_task_id] });
      qc.invalidateQueries({ queryKey: ["tasks", v.list_id] });
    },
  });
}
