
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_workspace_id UUID;
  user_count integer;
  auto_role app_role;
BEGIN
  -- Find existing workspace (there should be only one)
  SELECT id INTO existing_workspace_id FROM public.workspaces LIMIT 1;

  IF existing_workspace_id IS NULL THEN
    -- First user ever: create workspace, assign admin
    INSERT INTO public.workspaces (name) VALUES ('Workspace') RETURNING id INTO existing_workspace_id;
    auto_role := 'admin';
  ELSE
    auto_role := 'usuario';
  END IF;

  -- Create profile in the single shared workspace
  INSERT INTO public.profiles (user_id, workspace_id, name, email)
  VALUES (
    NEW.id,
    existing_workspace_id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, auto_role);

  -- Create default collection only for the first user
  IF auto_role = 'admin' THEN
    INSERT INTO public.collections (name, workspace_id, created_by)
    VALUES ('Meu Projeto', existing_workspace_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
