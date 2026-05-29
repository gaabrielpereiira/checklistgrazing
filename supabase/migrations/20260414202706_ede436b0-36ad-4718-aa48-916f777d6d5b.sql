ALTER TABLE public.column_connections
  ADD COLUMN IF NOT EXISTS assignee_config jsonb DEFAULT NULL;