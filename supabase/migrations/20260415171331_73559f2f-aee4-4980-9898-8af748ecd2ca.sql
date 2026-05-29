-- 1. Add is_archived to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON public.tasks(is_archived) WHERE is_archived = false;

-- 2. Drop the old trigger that auto-set is_done based on last column position
DROP TRIGGER IF EXISTS set_task_is_done ON public.tasks;
DROP FUNCTION IF EXISTS public.handle_task_is_done();

-- 3. Expand column_automations CHECK to include new action types
ALTER TABLE public.column_automations
  DROP CONSTRAINT IF EXISTS column_automations_type_check;
ALTER TABLE public.column_automations
  ADD CONSTRAINT column_automations_type_check
  CHECK (type IN ('assign_user', 'set_priority', 'complete_task', 'archive_task'));

-- 4. New trigger: apply column automations (complete/archive) when task moves to a column
CREATE OR REPLACE FUNCTION public.handle_column_task_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auto_rec RECORD;
BEGIN
  IF OLD.column_id IS NOT DISTINCT FROM NEW.column_id THEN
    RETURN NEW;
  END IF;

  NEW.is_done := false;
  NEW.is_archived := false;

  FOR auto_rec IN
    SELECT type, value FROM public.column_automations WHERE column_id = NEW.column_id
  LOOP
    IF auto_rec.type = 'complete_task' THEN
      NEW.is_done := true;
    ELSIF auto_rec.type = 'archive_task' THEN
      NEW.is_archived := true;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_column_task_action ON public.tasks;
CREATE TRIGGER trg_column_task_action
BEFORE UPDATE OF column_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_column_task_action();

-- Also handle INSERT
CREATE OR REPLACE FUNCTION public.handle_column_task_action_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auto_rec RECORD;
BEGIN
  FOR auto_rec IN
    SELECT type, value FROM public.column_automations WHERE column_id = NEW.column_id
  LOOP
    IF auto_rec.type = 'complete_task' THEN
      NEW.is_done := true;
    ELSIF auto_rec.type = 'archive_task' THEN
      NEW.is_archived := true;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_column_task_action_insert ON public.tasks;
CREATE TRIGGER trg_column_task_action_insert
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_column_task_action_insert();