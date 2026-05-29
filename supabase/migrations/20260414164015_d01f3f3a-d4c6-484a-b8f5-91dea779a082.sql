
-- Add is_done boolean to tasks
ALTER TABLE public.tasks ADD COLUMN is_done boolean NOT NULL DEFAULT false;

-- Function to auto-set is_done based on column position
CREATE OR REPLACE FUNCTION public.handle_task_is_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_position integer;
  current_position integer;
BEGIN
  -- Get the max column position for this task's collection
  SELECT MAX(c.position) INTO max_position
  FROM public.columns c
  WHERE c.collection_id = NEW.collection_id;

  -- Get the position of the task's current column
  SELECT c.position INTO current_position
  FROM public.columns c
  WHERE c.id = NEW.column_id;

  -- Mark as done if in last column
  NEW.is_done := (current_position IS NOT NULL AND current_position = max_position);

  RETURN NEW;
END;
$$;

-- Trigger on insert and update of column_id or collection_id
CREATE TRIGGER set_task_is_done
BEFORE INSERT OR UPDATE OF column_id, collection_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_is_done();
