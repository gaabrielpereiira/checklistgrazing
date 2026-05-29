
-- WhatsApp instances table
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL DEFAULT get_user_workspace_id(),
  name TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View workspace instances" ON public.whatsapp_instances
  FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Create workspace instances" ON public.whatsapp_instances
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Update workspace instances" ON public.whatsapp_instances
  FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Delete workspace instances" ON public.whatsapp_instances
  FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

-- Secrets table (only accessible via service role in edge functions)
CREATE TABLE public.whatsapp_instance_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instance_secrets ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role can access secrets
