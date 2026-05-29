INSERT INTO public.task_kanban_history (task_id, collection_id, column_id, entered_at)
SELECT t.id, t.collection_id, t.column_id, t.created_at
FROM public.tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_kanban_history h WHERE h.task_id = t.id
);