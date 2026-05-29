
-- Impediments
CREATE TABLE public.impediments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  request_id UUID
);
ALTER TABLE public.impediments ENABLE ROW LEVEL SECURITY;

-- Requests (solicitations)
CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'refused');

CREATE TABLE public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  task_title TEXT NOT NULL,
  task_description TEXT,
  suggested_due_date DATE,
  impediment_id UUID REFERENCES public.impediments(id),
  status request_status NOT NULL DEFAULT 'pending',
  refusal_reason TEXT,
  accepted_task_id UUID REFERENCES public.tasks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Add FK from impediments to requests now that requests table exists
ALTER TABLE public.impediments ADD CONSTRAINT impediments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);

-- Notifications
CREATE TYPE public.notification_type AS ENUM ('request_received', 'request_accepted', 'request_refused', 'task_due_today', 'impediment_resolved');

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Trigger for requests updated_at
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Impediments (workspace-scoped through task)
CREATE POLICY "View impediments" ON public.impediments FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

CREATE POLICY "Create impediments" ON public.impediments FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

CREATE POLICY "Update impediments" ON public.impediments FOR UPDATE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

-- RLS: Requests (user can see sent or received)
CREATE POLICY "View own requests" ON public.requests FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Create requests" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Update received requests" ON public.requests FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid());

-- RLS: Notifications
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Function to create notification when request is created
CREATE OR REPLACE FUNCTION public.handle_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.to_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, reference_id, reference_type, message)
    VALUES (NEW.to_user_id, 'request_received', NEW.id, 'request', 'Você recebeu uma nova solicitação de task');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_request_created
  AFTER INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_request();

-- Function to notify when request status changes
CREATE OR REPLACE FUNCTION public.handle_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, reference_id, reference_type, message)
    VALUES (NEW.from_user_id, 'request_accepted', NEW.id, 'request', 'Sua solicitação foi aceita');
  ELSIF OLD.status = 'pending' AND NEW.status = 'refused' THEN
    INSERT INTO public.notifications (user_id, type, reference_id, reference_type, message)
    VALUES (NEW.from_user_id, 'request_refused', NEW.id, 'request', 'Sua solicitação foi recusada');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_request_status_change
  AFTER UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_status_change();
