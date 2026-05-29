import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkspaceSettings {
  id: string;
  planning_mode: "hours" | "days" | null;
  daily_work_hours: number;
  work_start_time: string;
  weekend_days: number[];
}

export interface WorkspaceHoliday {
  id: string;
  workspace_id: string;
  holiday_date: string;
  label: string | null;
  created_at: string;
}

export function useWorkspaceSettings() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["workspace-settings"],
    enabled: !!profile?.workspace_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, planning_mode, daily_work_hours, work_start_time, weekend_days")
        .eq("id", profile!.workspace_id!)
        .single();
      if (error) throw error;
      return data as unknown as WorkspaceSettings;
    },
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (updates: Partial<Pick<WorkspaceSettings, "planning_mode" | "daily_work_hours" | "work_start_time" | "weekend_days">>) => {
      const { error } = await supabase
        .from("workspaces")
        .update(updates as any)
        .eq("id", profile!.workspace_id!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-settings"] }),
  });
}

export function useWorkspaceHolidays() {
  return useQuery({
    queryKey: ["workspace-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_holidays")
        .select("*")
        .order("holiday_date");
      if (error) throw error;
      return data as unknown as WorkspaceHoliday[];
    },
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ holiday_date, label }: { holiday_date: string; label?: string }) => {
      const { error } = await supabase
        .from("workspace_holidays")
        .insert({ workspace_id: profile!.workspace_id!, holiday_date, label } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-holidays"] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workspace_holidays")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-holidays"] }),
  });
}
