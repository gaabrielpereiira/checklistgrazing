
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View workspace projects" ON public.projects
  FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Create projects by role" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "Update projects by role" ON public.projects
  FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "Delete projects by role" ON public.projects
  FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND get_user_role() IN ('admin', 'gestor'));

-- Add project fields to tasks
ALTER TABLE public.tasks
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN duration_days INTEGER,
  ADD COLUMN position_day INTEGER;

-- Update linked card trigger to copy project_id
CREATE OR REPLACE FUNCTION public.handle_linked_card_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  linked_task RECORD;
  linked_collection RECORD;
BEGIN
  IF NEW.linked_task_id IS NOT NULL AND (OLD IS NULL OR OLD.linked_task_id IS DISTINCT FROM NEW.linked_task_id) THEN
    SELECT t.created_by, t.title, t.collection_id, t.project_id INTO linked_task
    FROM public.tasks t WHERE t.id = NEW.linked_task_id;
    
    -- Copy project_id from linked task if not already set
    IF NEW.project_id IS NULL AND linked_task.project_id IS NOT NULL THEN
      NEW.project_id := linked_task.project_id;
    END IF;
    
    IF linked_task.created_by IS NOT NULL AND linked_task.created_by != NEW.created_by THEN
      SELECT c.name INTO linked_collection
      FROM public.collections c WHERE c.id = NEW.collection_id;
      
      INSERT INTO public.notifications (user_id, type, reference_id, reference_type, message)
      VALUES (linked_task.created_by, 'linked_card_created', NEW.id, 'task',
              'Card vinculado criado na coleção "' || COALESCE(linked_collection.name, '') || '": ' || NEW.title);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
