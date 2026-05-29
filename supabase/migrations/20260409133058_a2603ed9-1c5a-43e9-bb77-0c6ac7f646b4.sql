
-- Add color and wip_limit to columns
ALTER TABLE public.columns ADD COLUMN color text DEFAULT null;
ALTER TABLE public.columns ADD COLUMN wip_limit integer DEFAULT 0;

-- Create column_automations table
CREATE TABLE public.column_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id uuid NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('assign_user', 'set_priority')),
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.column_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View column automations" ON public.column_automations
  FOR SELECT TO authenticated
  USING (column_id IN (
    SELECT id FROM public.columns WHERE collection_id IN (
      SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
    )
  ));

CREATE POLICY "Create column automations" ON public.column_automations
  FOR INSERT TO authenticated
  WITH CHECK (column_id IN (
    SELECT id FROM public.columns WHERE collection_id IN (
      SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
    )
  ));

CREATE POLICY "Update column automations" ON public.column_automations
  FOR UPDATE TO authenticated
  USING (column_id IN (
    SELECT id FROM public.columns WHERE collection_id IN (
      SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
    )
  ));

CREATE POLICY "Delete column automations" ON public.column_automations
  FOR DELETE TO authenticated
  USING (column_id IN (
    SELECT id FROM public.columns WHERE collection_id IN (
      SELECT id FROM public.collections WHERE workspace_id = get_user_workspace_id()
    )
  ));
