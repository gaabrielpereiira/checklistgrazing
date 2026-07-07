CREATE INDEX IF NOT EXISTS tasks_position_idx ON public.tasks(list_id, position);
ALTER TABLE public.custom_fields ADD COLUMN IF NOT EXISTS width INTEGER;