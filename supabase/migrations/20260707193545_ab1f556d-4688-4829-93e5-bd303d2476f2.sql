
-- ============================================================
-- DROP old schema
-- ============================================================
DROP TABLE IF EXISTS public.task_kanban_history CASCADE;
DROP TABLE IF EXISTS public.task_schedule_overrides CASCADE;
DROP TABLE IF EXISTS public.subtasks CASCADE;
DROP TABLE IF EXISTS public.column_automations CASCADE;
DROP TABLE IF EXISTS public.column_connections CASCADE;
DROP TABLE IF EXISTS public.columns CASCADE;
DROP TABLE IF EXISTS public.collection_teams CASCADE;
DROP TABLE IF EXISTS public.collection_users CASCADE;
DROP TABLE IF EXISTS public.impediments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.collections CASCADE;

DROP FUNCTION IF EXISTS public.handle_column_task_action_insert() CASCADE;
DROP FUNCTION IF EXISTS public.handle_column_task_action() CASCADE;
DROP FUNCTION IF EXISTS public.handle_task_kanban_history_insert() CASCADE;
DROP FUNCTION IF EXISTS public.handle_task_kanban_history_update() CASCADE;
DROP FUNCTION IF EXISTS public.handle_impediment_resolved() CASCADE;
DROP FUNCTION IF EXISTS public.handle_linked_card_created() CASCADE;
DROP FUNCTION IF EXISTS public.user_has_collection_access(uuid, uuid) CASCADE;

-- ============================================================
-- Helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
$$;

-- ============================================================
-- spaces
-- ============================================================
CREATE TABLE public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view spaces" ON public.spaces
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());
CREATE POLICY "managers manage spaces" ON public.spaces
  FOR ALL TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_manager())
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_manager());

CREATE TRIGGER spaces_updated BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- folders
-- ============================================================
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#94a3b8',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view folders" ON public.folders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));
CREATE POLICY "managers manage folders" ON public.folders
  FOR ALL TO authenticated
  USING (public.is_manager() AND EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()))
  WITH CHECK (public.is_manager() AND EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));

CREATE TRIGGER folders_updated BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- lists
-- ============================================================
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view lists" ON public.lists
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));
CREATE POLICY "managers manage lists" ON public.lists
  FOR ALL TO authenticated
  USING (public.is_manager() AND EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()))
  WITH CHECK (public.is_manager() AND EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));

CREATE TRIGGER lists_updated BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- docs
-- ============================================================
CREATE TABLE public.docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs TO authenticated;
GRANT ALL ON public.docs TO service_role;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view docs" ON public.docs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));
CREATE POLICY "workspace members insert docs" ON public.docs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));
CREATE POLICY "creator or manager update docs" ON public.docs
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_manager())
  WITH CHECK (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_id AND s.workspace_id = public.get_user_workspace_id()));
CREATE POLICY "creator or manager delete docs" ON public.docs
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_manager());

CREATE TRIGGER docs_updated BEFORE UPDATE ON public.docs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- statuses (per list)
-- ============================================================
CREATE TABLE public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  type TEXT NOT NULL DEFAULT 'active' CHECK (type IN ('todo','active','done')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statuses TO authenticated;
GRANT ALL ON public.statuses TO service_role;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view statuses" ON public.statuses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ));
CREATE POLICY "managers manage statuses" ON public.statuses
  FOR ALL TO authenticated
  USING (public.is_manager() AND EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ))
  WITH CHECK (public.is_manager() AND EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ));

CREATE TRIGGER statuses_updated BEFORE UPDATE ON public.statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create default statuses on new list
CREATE OR REPLACE FUNCTION public.seed_default_statuses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.statuses (list_id, name, color, type, position) VALUES
    (NEW.id, 'Pessoal', '#94a3b8', 'todo', 0),
    (NEW.id, 'Grazing', '#3b82f6', 'active', 1),
    (NEW.id, 'Outro', '#10b981', 'done', 2);
  RETURN NEW;
END;
$$;
CREATE TRIGGER lists_seed_statuses AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_statuses();

-- ============================================================
-- tasks (new)
-- ============================================================
CREATE TYPE public.task_priority_new AS ENUM ('baixa','media','alta','urgente');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  status_id UUID REFERENCES public.statuses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE,
  due_time TIME,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.task_priority_new NOT NULL DEFAULT 'media',
  position INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ));
CREATE POLICY "workspace members create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ));
CREATE POLICY "task participants update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assignee_id = auth.uid() OR public.is_manager())
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ));
CREATE POLICY "task creator or manager delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_manager());

CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tasks_list_idx ON public.tasks(list_id);
CREATE INDEX tasks_parent_idx ON public.tasks(parent_task_id);
CREATE INDEX tasks_assignee_idx ON public.tasks(assignee_id);

-- ============================================================
-- custom_fields
-- ============================================================
CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','number','select','date','checkbox','user','url','email')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view fields" ON public.custom_fields
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
    WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
  ));
CREATE POLICY "managers manage fields" ON public.custom_fields
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE TRIGGER custom_fields_updated BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- task_field_values
-- ============================================================
CREATE TABLE public.task_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, field_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_field_values TO authenticated;
GRANT ALL ON public.task_field_values TO service_role;
ALTER TABLE public.task_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members access field values" ON public.task_field_values
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t JOIN public.lists l ON l.id = t.list_id JOIN public.spaces s ON s.id = l.space_id
    WHERE t.id = task_id AND s.workspace_id = public.get_user_workspace_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t JOIN public.lists l ON l.id = t.list_id JOIN public.spaces s ON s.id = l.space_id
    WHERE t.id = task_id AND s.workspace_id = public.get_user_workspace_id()
  ));

CREATE TRIGGER task_field_values_updated BEFORE UPDATE ON public.task_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- list_views
-- ============================================================
CREATE TABLE public.list_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('list','kanban','calendar','gantt')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_views TO authenticated;
GRANT ALL ON public.list_views TO service_role;
ALTER TABLE public.list_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view shared or own views" ON public.list_views
  FOR SELECT TO authenticated
  USING (
    (is_shared OR owner_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.lists l JOIN public.spaces s ON s.id = l.space_id
      WHERE l.id = list_id AND s.workspace_id = public.get_user_workspace_id()
    )
  );
CREATE POLICY "create own views" ON public.list_views
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner or manager update view" ON public.list_views
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_manager())
  WITH CHECK (owner_id = auth.uid() OR public.is_manager());
CREATE POLICY "owner or manager delete view" ON public.list_views
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_manager());

CREATE TRIGGER list_views_updated BEFORE UPDATE ON public.list_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Seed: for each workspace, create Space > Folder > List
-- ============================================================
DO $$
DECLARE
  ws RECORD;
  admin_user UUID;
  new_space UUID;
  new_folder UUID;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces LOOP
    SELECT ur.user_id INTO admin_user
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = 'admin' AND p.workspace_id = ws.id
      LIMIT 1;

    INSERT INTO public.spaces (workspace_id, name, color, icon, created_by)
    VALUES (ws.id, 'Geral', '#6366f1', 'folder', admin_user)
    RETURNING id INTO new_space;

    INSERT INTO public.folders (space_id, name, created_by)
    VALUES (new_space, 'Padrão', admin_user)
    RETURNING id INTO new_folder;

    INSERT INTO public.lists (space_id, folder_id, name, is_default, created_by)
    VALUES (new_space, new_folder, 'Minhas Tarefas', true, admin_user);
  END LOOP;
END $$;
