
-- Add slack_user_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slack_user_id text;

-- Slack settings table (one per workspace)
CREATE TABLE IF NOT EXISTS public.slack_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  signing_secret text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.slack_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view workspace slack settings"
ON public.slack_settings FOR SELECT TO authenticated
USING (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert workspace slack settings"
ON public.slack_settings FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update workspace slack settings"
ON public.slack_settings FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete workspace slack settings"
ON public.slack_settings FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_slack_settings_updated_at
BEFORE UPDATE ON public.slack_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
