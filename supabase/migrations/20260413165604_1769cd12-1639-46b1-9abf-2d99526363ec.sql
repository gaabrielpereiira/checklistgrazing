
CREATE TABLE public.task_schedule_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  start_hour numeric NOT NULL DEFAULT 9,
  hours numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (task_id, work_date)
);

ALTER TABLE public.task_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View task schedule overrides"
ON public.task_schedule_overrides
FOR SELECT
TO authenticated
USING (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
    AND user_has_collection_access(auth.uid(), c.id)
));

CREATE POLICY "Create task schedule overrides"
ON public.task_schedule_overrides
FOR INSERT
TO authenticated
WITH CHECK (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
    AND user_has_collection_access(auth.uid(), c.id)
));

CREATE POLICY "Update task schedule overrides"
ON public.task_schedule_overrides
FOR UPDATE
TO authenticated
USING (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
    AND user_has_collection_access(auth.uid(), c.id)
));

CREATE POLICY "Delete task schedule overrides"
ON public.task_schedule_overrides
FOR DELETE
TO authenticated
USING (task_id IN (
  SELECT t.id FROM public.tasks t
  JOIN public.collections c ON t.collection_id = c.id
  WHERE c.workspace_id = get_user_workspace_id()
    AND user_has_collection_access(auth.uid(), c.id)
));

CREATE INDEX idx_task_schedule_overrides_task_id ON public.task_schedule_overrides(task_id);
