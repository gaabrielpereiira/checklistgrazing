
-- Add new notification type
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'linked_card_created';

-- Ensure triggers for requests exist
DROP TRIGGER IF EXISTS on_new_request ON public.requests;
CREATE TRIGGER on_new_request
  AFTER INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_request();

DROP TRIGGER IF EXISTS on_request_status_change ON public.requests;
CREATE TRIGGER on_request_status_change
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_request_status_change();

-- Impediment resolved trigger
CREATE OR REPLACE FUNCTION public.handle_impediment_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL THEN
    -- Notify the task creator
    INSERT INTO public.notifications (user_id, type, reference_id, reference_type, message)
    SELECT t.created_by, 'impediment_resolved', NEW.task_id, 'task',
           'Impedimento resolvido na task "' || t.title || '"'
    FROM public.tasks t WHERE t.id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_impediment_resolved ON public.impediments;
CREATE TRIGGER on_impediment_resolved
  AFTER UPDATE ON public.impediments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_impediment_resolved();

-- Linked card created trigger
CREATE OR REPLACE FUNCTION public.handle_linked_card_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_task RECORD;
  linked_collection RECORD;
BEGIN
  IF NEW.linked_task_id IS NOT NULL AND (OLD IS NULL OR OLD.linked_task_id IS DISTINCT FROM NEW.linked_task_id) THEN
    -- Get the linked task's creator
    SELECT t.created_by, t.title, t.collection_id INTO linked_task
    FROM public.tasks t WHERE t.id = NEW.linked_task_id;
    
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

DROP TRIGGER IF EXISTS on_linked_card_created ON public.tasks;
CREATE TRIGGER on_linked_card_created
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_linked_card_created();
