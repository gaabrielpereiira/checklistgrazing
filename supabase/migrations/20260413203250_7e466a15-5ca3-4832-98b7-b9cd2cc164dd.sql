
-- 1. Add color field to collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS color text DEFAULT NULL;

-- 2. Create task_kanban_history table
CREATE TABLE public.task_kanban_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz DEFAULT NULL,
  time_limit_hours numeric DEFAULT NULL
);

CREATE INDEX idx_task_kanban_history_task_id ON public.task_kanban_history(task_id);
CREATE INDEX idx_task_kanban_history_collection_id ON public.task_kanban_history(collection_id);

-- 3. Enable RLS
ALTER TABLE public.task_kanban_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "View task kanban history"
ON public.task_kanban_history FOR SELECT TO authenticated
USING (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
));

CREATE POLICY "Insert task kanban history"
ON public.task_kanban_history FOR INSERT TO authenticated
WITH CHECK (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
));

CREATE POLICY "Update task kanban history"
ON public.task_kanban_history FOR UPDATE TO authenticated
USING (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
));

-- 5. Trigger: auto-create history on task insert
CREATE OR REPLACE FUNCTION public.handle_task_kanban_history_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.task_kanban_history (task_id, collection_id, column_id, entered_at)
  VALUES (NEW.id, NEW.collection_id, NEW.column_id, now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_kanban_history_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_kanban_history_insert();

-- 6. Trigger: auto-manage history on task collection change
CREATE OR REPLACE FUNCTION public.handle_task_kanban_history_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when collection_id changes
  IF OLD.collection_id IS DISTINCT FROM NEW.collection_id THEN
    -- Close current open record
    UPDATE public.task_kanban_history
    SET exited_at = now()
    WHERE task_id = NEW.id AND exited_at IS NULL;

    -- Open new record
    INSERT INTO public.task_kanban_history (task_id, collection_id, column_id, entered_at)
    VALUES (NEW.id, NEW.collection_id, NEW.column_id, now());
  -- Track column changes within same collection
  ELSIF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
    UPDATE public.task_kanban_history
    SET column_id = NEW.column_id
    WHERE task_id = NEW.id AND exited_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_kanban_history_update
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_kanban_history_update();
