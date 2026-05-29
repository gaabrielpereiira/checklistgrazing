
-- Add sector_id to collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Helper: get current user's sector_id
CREATE OR REPLACE FUNCTION public.get_user_sector_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sector_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- ═══ COLLECTIONS RLS ═══
-- Drop existing policies
DROP POLICY IF EXISTS "View workspace collections" ON public.collections;
DROP POLICY IF EXISTS "Create workspace collections" ON public.collections;
DROP POLICY IF EXISTS "Update workspace collections" ON public.collections;
DROP POLICY IF EXISTS "Delete workspace collections" ON public.collections;

-- Admin sees all workspace collections
-- Gestor sees collections in their sector (or without sector)
-- Usuario sees collections in their sector (or without sector)
CREATE POLICY "View collections by role" ON public.collections FOR SELECT TO authenticated
USING (
  workspace_id = get_user_workspace_id()
  AND (
    get_user_role() = 'admin'
    OR sector_id IS NULL
    OR sector_id = get_user_sector_id()
  )
);

-- Only admin and gestor can create collections
CREATE POLICY "Create collections by role" ON public.collections FOR INSERT TO authenticated
WITH CHECK (
  workspace_id = get_user_workspace_id()
  AND get_user_role() IN ('admin', 'gestor')
);

-- Admin can update any; gestor only their sector
CREATE POLICY "Update collections by role" ON public.collections FOR UPDATE TO authenticated
USING (
  workspace_id = get_user_workspace_id()
  AND (
    get_user_role() = 'admin'
    OR (get_user_role() = 'gestor' AND (sector_id IS NULL OR sector_id = get_user_sector_id()))
  )
);

-- Only admin can delete collections
CREATE POLICY "Delete collections by role" ON public.collections FOR DELETE TO authenticated
USING (
  workspace_id = get_user_workspace_id()
  AND get_user_role() = 'admin'
);

-- ═══ TASKS RLS ═══
DROP POLICY IF EXISTS "View tasks" ON public.tasks;
DROP POLICY IF EXISTS "Create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Delete tasks" ON public.tasks;

-- Admin: all tasks in workspace
-- Gestor: tasks in their sector collections + assigned to them
-- Usuario: tasks in their sector collections + assigned to them
CREATE POLICY "View tasks by role" ON public.tasks FOR SELECT TO authenticated
USING (
  collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
  AND (
    get_user_role() = 'admin'
    OR assignee_id = auth.uid()
    OR collection_id IN (
      SELECT id FROM public.collections
      WHERE workspace_id = get_user_workspace_id()
      AND (sector_id IS NULL OR sector_id = get_user_sector_id())
    )
  )
);

-- All authenticated users in workspace can create tasks
CREATE POLICY "Create tasks by role" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
);

-- All can update tasks they can see
CREATE POLICY "Update tasks by role" ON public.tasks FOR UPDATE TO authenticated
USING (
  collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
  AND (
    get_user_role() = 'admin'
    OR assignee_id = auth.uid()
    OR collection_id IN (
      SELECT id FROM public.collections
      WHERE workspace_id = get_user_workspace_id()
      AND (sector_id IS NULL OR sector_id = get_user_sector_id())
    )
  )
);

-- Only admin can delete tasks, or task creator
CREATE POLICY "Delete tasks by role" ON public.tasks FOR DELETE TO authenticated
USING (
  collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
  AND (
    get_user_role() = 'admin'
    OR created_by = auth.uid()
  )
);

-- ═══ COLUMNS RLS ═══
DROP POLICY IF EXISTS "View columns" ON public.columns;
DROP POLICY IF EXISTS "Create columns" ON public.columns;
DROP POLICY IF EXISTS "Update columns" ON public.columns;
DROP POLICY IF EXISTS "Delete columns" ON public.columns;

-- All can view columns of collections they can see
CREATE POLICY "View columns by role" ON public.columns FOR SELECT TO authenticated
USING (
  collection_id IN (
    SELECT id FROM public.collections
    WHERE workspace_id = get_user_workspace_id()
    AND (
      get_user_role() = 'admin'
      OR sector_id IS NULL
      OR sector_id = get_user_sector_id()
    )
  )
);

-- Only admin and gestor can create/update/delete columns
CREATE POLICY "Create columns by role" ON public.columns FOR INSERT TO authenticated
WITH CHECK (
  get_user_role() IN ('admin', 'gestor')
  AND collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
);

CREATE POLICY "Update columns by role" ON public.columns FOR UPDATE TO authenticated
USING (
  get_user_role() IN ('admin', 'gestor')
  AND collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
);

CREATE POLICY "Delete columns by role" ON public.columns FOR DELETE TO authenticated
USING (
  get_user_role() IN ('admin', 'gestor')
  AND collection_id IN (
    SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
  )
);

-- ═══ COLUMN CONNECTIONS RLS ═══
DROP POLICY IF EXISTS "View column connections" ON public.column_connections;
DROP POLICY IF EXISTS "Create column connections" ON public.column_connections;
DROP POLICY IF EXISTS "Delete column connections" ON public.column_connections;

-- All can view connections
CREATE POLICY "View connections by role" ON public.column_connections FOR SELECT TO authenticated
USING (
  source_column_id IN (
    SELECT c.id FROM public.columns c
    JOIN public.collections col ON c.collection_id = col.id
    WHERE col.workspace_id = get_user_workspace_id()
  )
);

-- Only admin and gestor can create/delete connections
CREATE POLICY "Create connections by role" ON public.column_connections FOR INSERT TO authenticated
WITH CHECK (
  get_user_role() IN ('admin', 'gestor')
  AND source_column_id IN (
    SELECT c.id FROM public.columns c
    JOIN public.collections col ON c.collection_id = col.id
    WHERE col.workspace_id = get_user_workspace_id()
  )
);

CREATE POLICY "Delete connections by role" ON public.column_connections FOR DELETE TO authenticated
USING (
  get_user_role() IN ('admin', 'gestor')
  AND source_column_id IN (
    SELECT c.id FROM public.columns c
    JOIN public.collections col ON c.collection_id = col.id
    WHERE col.workspace_id = get_user_workspace_id()
  )
);
