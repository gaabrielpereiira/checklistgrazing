-- Add planning configuration to workspaces
CREATE TYPE public.planning_mode AS ENUM ('hours', 'days');

ALTER TABLE public.workspaces
  ADD COLUMN planning_mode public.planning_mode,
  ADD COLUMN daily_work_hours integer NOT NULL DEFAULT 8,
  ADD COLUMN work_start_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN weekend_days integer[] NOT NULL DEFAULT '{0,6}';

-- Create workspace holidays table
CREATE TABLE public.workspace_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, holiday_date)
);

ALTER TABLE public.workspace_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View workspace holidays"
  ON public.workspace_holidays FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Manage workspace holidays"
  ON public.workspace_holidays FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "Update workspace holidays"
  ON public.workspace_holidays FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "Delete workspace holidays"
  ON public.workspace_holidays FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND get_user_role() IN ('admin', 'gestor'));

-- Add hour-based fields to tasks
ALTER TABLE public.tasks
  ADD COLUMN duration_hours numeric,
  ADD COLUMN position_hour numeric;