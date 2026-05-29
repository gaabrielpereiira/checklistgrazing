
-- Create sectors table
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View workspace sectors" ON public.sectors FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Create workspace sectors" ON public.sectors FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());
CREATE POLICY "Update workspace sectors" ON public.sectors FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Delete workspace sectors" ON public.sectors FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

-- Add sector_id to profiles
ALTER TABLE public.profiles ADD COLUMN sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Allow admins to update any profile in their workspace (for user management)
CREATE POLICY "Admins can update workspace profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'));

-- Create column_connections table
CREATE TABLE public.column_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  target_column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_column_id, target_column_id)
);
ALTER TABLE public.column_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View column connections" ON public.column_connections FOR SELECT TO authenticated
  USING (
    source_column_id IN (SELECT id FROM public.columns WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()))
  );
CREATE POLICY "Create column connections" ON public.column_connections FOR INSERT TO authenticated
  WITH CHECK (
    source_column_id IN (SELECT id FROM public.columns WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()))
  );
CREATE POLICY "Delete column connections" ON public.column_connections FOR DELETE TO authenticated
  USING (
    source_column_id IN (SELECT id FROM public.columns WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()))
  );

-- Allow admins to manage user roles in their workspace
CREATE POLICY "Admins can view workspace roles" ON public.user_roles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND
    user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.workspace_id = get_user_workspace_id())
  );
CREATE POLICY "Admins can update workspace roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND
    user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.workspace_id = get_user_workspace_id())
  );
