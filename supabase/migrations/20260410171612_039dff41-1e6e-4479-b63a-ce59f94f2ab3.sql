
-- Teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View workspace teams" ON public.teams FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Admins can create teams" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'));

-- Team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View team members" ON public.team_members FOR SELECT TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE workspace_id = get_user_workspace_id()));
CREATE POLICY "Admins can insert team members" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE workspace_id = get_user_workspace_id()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete team members" ON public.team_members FOR DELETE TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE workspace_id = get_user_workspace_id()) AND has_role(auth.uid(), 'admin'));

-- Collection teams table
CREATE TABLE public.collection_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collection_id, team_id)
);
ALTER TABLE public.collection_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View collection teams" ON public.collection_teams FOR SELECT TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()));
CREATE POLICY "Admins can insert collection teams" ON public.collection_teams FOR INSERT TO authenticated
  WITH CHECK (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete collection teams" ON public.collection_teams FOR DELETE TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()) AND has_role(auth.uid(), 'admin'));

-- Collection users table
CREATE TABLE public.collection_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collection_id, user_id)
);
ALTER TABLE public.collection_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View collection users" ON public.collection_users FOR SELECT TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()));
CREATE POLICY "Admins can insert collection users" ON public.collection_users FOR INSERT TO authenticated
  WITH CHECK (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete collection users" ON public.collection_users FOR DELETE TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()) AND has_role(auth.uid(), 'admin'));

-- Helper function: does current user have access to a collection?
CREATE OR REPLACE FUNCTION public.user_has_collection_access(_user_id UUID, _collection_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- Admin always has access
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    -- Direct user access
    SELECT 1 FROM public.collection_users WHERE collection_id = _collection_id AND user_id = _user_id
  ) OR EXISTS (
    -- Access via team
    SELECT 1 FROM public.collection_teams ct
    JOIN public.team_members tm ON tm.team_id = ct.team_id
    WHERE ct.collection_id = _collection_id AND tm.user_id = _user_id
  ) OR NOT EXISTS (
    -- If collection has NO access rules (no teams, no users), everyone can see it
    SELECT 1 FROM public.collection_teams WHERE collection_id = _collection_id
    UNION ALL
    SELECT 1 FROM public.collection_users WHERE collection_id = _collection_id
  )
$$;

-- Update collections RLS: replace old policies
DROP POLICY IF EXISTS "View collections by role" ON public.collections;
CREATE POLICY "View collections by role" ON public.collections FOR SELECT TO authenticated
  USING (
    workspace_id = get_user_workspace_id()
    AND user_has_collection_access(auth.uid(), id)
  );

-- Update tasks RLS: replace old view policy
DROP POLICY IF EXISTS "View tasks by role" ON public.tasks;
CREATE POLICY "View tasks by role" ON public.tasks FOR SELECT TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM public.collections
      WHERE workspace_id = get_user_workspace_id()
        AND user_has_collection_access(auth.uid(), id)
    )
  );

-- Update tasks update policy too
DROP POLICY IF EXISTS "Update tasks by role" ON public.tasks;
CREATE POLICY "Update tasks by role" ON public.tasks FOR UPDATE TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM public.collections
      WHERE workspace_id = get_user_workspace_id()
        AND user_has_collection_access(auth.uid(), id)
    )
  );
