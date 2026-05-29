-- Create user_sectors join table
CREATE TABLE public.user_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sector_id)
);

-- Enable RLS
ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

-- Policies for user_sectors
CREATE POLICY "Users can view own sectors"
ON public.user_sectors FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view workspace user sectors"
ON public.user_sectors FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND
  user_id IN (SELECT p.user_id FROM profiles p WHERE p.workspace_id = get_user_workspace_id())
);

CREATE POLICY "Admins can insert user sectors"
ON public.user_sectors FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') AND
  user_id IN (SELECT p.user_id FROM profiles p WHERE p.workspace_id = get_user_workspace_id())
);

CREATE POLICY "Admins can delete user sectors"
ON public.user_sectors FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND
  user_id IN (SELECT p.user_id FROM profiles p WHERE p.workspace_id = get_user_workspace_id())
);

-- Migrate existing sector_id data from profiles to user_sectors
INSERT INTO public.user_sectors (user_id, sector_id)
SELECT user_id, sector_id FROM public.profiles
WHERE sector_id IS NOT NULL
ON CONFLICT (user_id, sector_id) DO NOTHING;

-- Create new function that returns array of sector IDs
CREATE OR REPLACE FUNCTION public.get_user_sector_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(sector_id),
    ARRAY[]::uuid[]
  )
  FROM public.user_sectors
  WHERE user_id = auth.uid()
$$;

-- Update get_user_sector_id to return the first sector (backward compat)
CREATE OR REPLACE FUNCTION public.get_user_sector_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sector_id FROM public.user_sectors WHERE user_id = auth.uid() LIMIT 1
$$;

-- Update collections VIEW policy to use array check
DROP POLICY IF EXISTS "View collections by role" ON public.collections;
CREATE POLICY "View collections by role"
ON public.collections FOR SELECT TO authenticated
USING (
  workspace_id = get_user_workspace_id()
  AND (
    get_user_role() = 'admin'
    OR sector_id IS NULL
    OR sector_id = ANY(get_user_sector_ids())
  )
);

-- Update collections UPDATE policy
DROP POLICY IF EXISTS "Update collections by role" ON public.collections;
CREATE POLICY "Update collections by role"
ON public.collections FOR UPDATE TO authenticated
USING (
  workspace_id = get_user_workspace_id()
  AND (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'gestor'
      AND (sector_id IS NULL OR sector_id = ANY(get_user_sector_ids()))
    )
  )
);

-- Update columns VIEW policy
DROP POLICY IF EXISTS "View columns by role" ON public.columns;
CREATE POLICY "View columns by role"
ON public.columns FOR SELECT TO authenticated
USING (
  collection_id IN (
    SELECT id FROM collections
    WHERE workspace_id = get_user_workspace_id()
    AND (
      get_user_role() = 'admin'
      OR sector_id IS NULL
      OR sector_id = ANY(get_user_sector_ids())
    )
  )
);

-- Update tasks VIEW policy
DROP POLICY IF EXISTS "View tasks by role" ON public.tasks;
CREATE POLICY "View tasks by role"
ON public.tasks FOR SELECT TO authenticated
USING (
  collection_id IN (
    SELECT id FROM collections WHERE workspace_id = get_user_workspace_id()
  )
  AND (
    get_user_role() = 'admin'
    OR assignee_id = auth.uid()
    OR collection_id IN (
      SELECT id FROM collections
      WHERE workspace_id = get_user_workspace_id()
      AND (sector_id IS NULL OR sector_id = ANY(get_user_sector_ids()))
    )
  )
);

-- Update tasks UPDATE policy
DROP POLICY IF EXISTS "Update tasks by role" ON public.tasks;
CREATE POLICY "Update tasks by role"
ON public.tasks FOR UPDATE TO authenticated
USING (
  collection_id IN (
    SELECT id FROM collections WHERE workspace_id = get_user_workspace_id()
  )
  AND (
    get_user_role() = 'admin'
    OR assignee_id = auth.uid()
    OR collection_id IN (
      SELECT id FROM collections
      WHERE workspace_id = get_user_workspace_id()
      AND (sector_id IS NULL OR sector_id = ANY(get_user_sector_ids()))
    )
  )
);