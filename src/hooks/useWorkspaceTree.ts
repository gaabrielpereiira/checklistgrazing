import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SpaceRow {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
}
export interface FolderRow {
  id: string;
  space_id: string;
  name: string;
  color: string | null;
  position: number;
}
export interface ListRow {
  id: string;
  space_id: string;
  folder_id: string | null;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
}
export interface DocRow {
  id: string;
  space_id: string;
  folder_id: string | null;
  title: string;
  position: number;
}

export interface TreeNode {
  space: SpaceRow;
  folders: (FolderRow & { lists: ListRow[]; docs: DocRow[] })[];
  looseLists: ListRow[];
  looseDocs: DocRow[];
}

export function useWorkspaceTree() {
  return useQuery<TreeNode[]>({
    queryKey: ["workspace-tree"],
    queryFn: async () => {
      const [spacesRes, foldersRes, listsRes, docsRes] = await Promise.all([
        supabase.from("spaces").select("*").order("position"),
        supabase.from("folders").select("*").order("position"),
        supabase.from("lists").select("*").order("position"),
        supabase.from("docs").select("id, space_id, folder_id, title, position").order("position"),
      ]);
      if (spacesRes.error) throw spacesRes.error;
      if (foldersRes.error) throw foldersRes.error;
      if (listsRes.error) throw listsRes.error;
      if (docsRes.error) throw docsRes.error;

      const spaces = (spacesRes.data || []) as SpaceRow[];
      const folders = (foldersRes.data || []) as FolderRow[];
      const lists = (listsRes.data || []) as ListRow[];
      const docs = (docsRes.data || []) as DocRow[];

      return spaces.map((space) => {
        const spaceFolders = folders
          .filter((f) => f.space_id === space.id)
          .map((f) => ({
            ...f,
            lists: lists.filter((l) => l.folder_id === f.id),
            docs: docs.filter((d) => d.folder_id === f.id),
          }));
        return {
          space,
          folders: spaceFolders,
          looseLists: lists.filter((l) => l.space_id === space.id && !l.folder_id),
          looseDocs: docs.filter((d) => d.space_id === space.id && !d.folder_id),
        };
      });
    },
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.workspace_id) throw new Error("no workspace");
      const { data, error } = await supabase
        .from("spaces")
        .insert({ name, workspace_id: profile.workspace_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tree"] }),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ space_id, name }: { space_id: string; name: string }) => {
      const { data, error } = await supabase.from("folders").insert({ space_id, name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tree"] }),
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ space_id, folder_id, name }: { space_id: string; folder_id?: string | null; name: string }) => {
      const { data, error } = await supabase
        .from("lists")
        .insert({ space_id, folder_id: folder_id ?? null, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tree"] }),
  });
}

export function useCreateDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ space_id, folder_id, title }: { space_id: string; folder_id?: string | null; title: string }) => {
      const { data, error } = await supabase
        .from("docs")
        .insert({ space_id, folder_id: folder_id ?? null, title, content: {} })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tree"] }),
  });
}

export function useRenameNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ table, id, name }: { table: "spaces" | "folders" | "lists"; id: string; name: string }) => {
      const { error } = await supabase.from(table).update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tree"] }),
  });
}

export function useDeleteNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ table, id }: { table: "spaces" | "folders" | "lists" | "docs"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tree"] }),
  });
}
