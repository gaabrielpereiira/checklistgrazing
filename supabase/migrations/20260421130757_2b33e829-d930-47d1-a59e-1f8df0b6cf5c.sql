
-- 1. Habilitar extensão Vault
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. Tabela de registro (escopo workspace)
CREATE TABLE public.api_keys_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  vault_secret_id UUID NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_registry_workspace ON public.api_keys_registry(workspace_id, service_name);

ALTER TABLE public.api_keys_registry ENABLE ROW LEVEL SECURITY;

-- Admins/gestores do workspace veem; só admins gravam/removem via RPC
CREATE POLICY "View workspace api keys"
  ON public.api_keys_registry
  FOR SELECT
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Sem INSERT/UPDATE/DELETE direto pelo client — tudo via RPC
-- (nada de policy permissiva pra escrita)

CREATE TRIGGER trg_api_keys_registry_updated_at
  BEFORE UPDATE ON public.api_keys_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Helpers Vault (SECURITY DEFINER, search_path travado)

-- Grava um secret novo no vault e devolve o id
CREATE OR REPLACE FUNCTION public.vault_store_workspace_secret(
  _workspace_id UUID,
  _service_name TEXT,
  _secret_value TEXT,
  _label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_existing UUID;
  v_secret_name TEXT;
BEGIN
  -- Apenas admins ou gestores do workspace podem armazenar
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'gestor'::app_role)) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF public.get_user_workspace_id() <> _workspace_id THEN
    RAISE EXCEPTION 'workspace mismatch';
  END IF;

  v_secret_name := _service_name || '_' || _workspace_id::text;

  -- Se já existe registro, atualiza o secret no vault
  SELECT vault_secret_id INTO v_existing
  FROM public.api_keys_registry
  WHERE workspace_id = _workspace_id AND service_name = _service_name;

  IF v_existing IS NOT NULL THEN
    UPDATE vault.secrets
       SET secret = _secret_value,
           description = COALESCE(_label, description)
     WHERE id = v_existing;

    UPDATE public.api_keys_registry
       SET label = COALESCE(_label, label),
           is_active = true,
           updated_at = now()
     WHERE workspace_id = _workspace_id AND service_name = _service_name;

    RETURN v_existing;
  END IF;

  -- Insere no vault
  v_secret_id := vault.create_secret(_secret_value, v_secret_name, COALESCE(_label, _service_name));

  INSERT INTO public.api_keys_registry (workspace_id, service_name, vault_secret_id, label, created_by)
  VALUES (_workspace_id, _service_name, v_secret_id, _label, auth.uid());

  RETURN v_secret_id;
END;
$$;

-- Remove secret do vault e do registry
CREATE OR REPLACE FUNCTION public.vault_delete_workspace_secret(
  _workspace_id UUID,
  _service_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF public.get_user_workspace_id() <> _workspace_id THEN
    RAISE EXCEPTION 'workspace mismatch';
  END IF;

  SELECT vault_secret_id INTO v_secret_id
  FROM public.api_keys_registry
  WHERE workspace_id = _workspace_id AND service_name = _service_name;

  IF v_secret_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM vault.secrets WHERE id = v_secret_id;
  DELETE FROM public.api_keys_registry
   WHERE workspace_id = _workspace_id AND service_name = _service_name;

  RETURN true;
END;
$$;

-- Lê o secret descriptografado. APENAS service_role pode chamar (edge functions).
CREATE OR REPLACE FUNCTION public.vault_read_secret(_secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_value TEXT;
BEGIN
  -- Bloqueio: só service_role
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied: service_role only';
  END IF;

  SELECT decrypted_secret INTO v_value
  FROM vault.decrypted_secrets
  WHERE id = _secret_id;

  RETURN v_value;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vault_read_secret(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_read_secret(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.vault_store_workspace_secret(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_delete_workspace_secret(UUID, TEXT) TO authenticated;

-- 4. Migrar whatsapp_instance_secrets para vault
-- Adiciona colunas de referência ao vault
ALTER TABLE public.whatsapp_instance_secrets
  ADD COLUMN IF NOT EXISTS vault_url_id UUID,
  ADD COLUMN IF NOT EXISTS vault_key_id UUID;

-- Migrar dados existentes
DO $$
DECLARE
  rec RECORD;
  v_url_id UUID;
  v_key_id UUID;
BEGIN
  FOR rec IN
    SELECT s.id, s.instance_id, s.api_url, s.api_key, i.workspace_id, i.instance_name
    FROM public.whatsapp_instance_secrets s
    JOIN public.whatsapp_instances i ON i.id = s.instance_id
    WHERE s.vault_key_id IS NULL
  LOOP
    v_url_id := vault.create_secret(
      rec.api_url,
      'whatsapp_evolution_url_' || rec.instance_id::text,
      'Evolution API URL for instance ' || rec.instance_name
    );
    v_key_id := vault.create_secret(
      rec.api_key,
      'whatsapp_evolution_key_' || rec.instance_id::text,
      'Evolution API Key for instance ' || rec.instance_name
    );

    UPDATE public.whatsapp_instance_secrets
       SET vault_url_id = v_url_id,
           vault_key_id = v_key_id
     WHERE id = rec.id;
  END LOOP;
END $$;

-- Remover colunas em texto plano
ALTER TABLE public.whatsapp_instance_secrets
  DROP COLUMN api_url,
  DROP COLUMN api_key;

-- RLS: leitura via service_role apenas; admin/gestor pode ver registros (mas não secret)
ALTER TABLE public.whatsapp_instance_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View workspace whatsapp secret refs"
  ON public.whatsapp_instance_secrets
  FOR SELECT
  TO authenticated
  USING (
    instance_id IN (
      SELECT id FROM public.whatsapp_instances
      WHERE workspace_id = public.get_user_workspace_id()
    )
  );

-- 5. Migrar slack_settings.signing_secret para vault
ALTER TABLE public.slack_settings
  ADD COLUMN IF NOT EXISTS vault_signing_secret_id UUID;

DO $$
DECLARE
  rec RECORD;
  v_id UUID;
BEGIN
  FOR rec IN
    SELECT id, workspace_id, signing_secret
    FROM public.slack_settings
    WHERE signing_secret IS NOT NULL
      AND signing_secret <> ''
      AND vault_signing_secret_id IS NULL
  LOOP
    v_id := vault.create_secret(
      rec.signing_secret,
      'slack_signing_' || rec.workspace_id::text,
      'Slack signing secret for workspace ' || rec.workspace_id::text
    );

    UPDATE public.slack_settings
       SET vault_signing_secret_id = v_id
     WHERE id = rec.id;

    -- Registrar no api_keys_registry para visibilidade
    INSERT INTO public.api_keys_registry (workspace_id, service_name, vault_secret_id, label)
    VALUES (rec.workspace_id, 'slack_signing', v_id, 'Slack Signing Secret')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Remover coluna em texto plano
ALTER TABLE public.slack_settings
  DROP COLUMN signing_secret;

-- Constraint única para api_keys_registry (workspace + service)
ALTER TABLE public.api_keys_registry
  ADD CONSTRAINT uq_api_keys_workspace_service UNIQUE (workspace_id, service_name);
