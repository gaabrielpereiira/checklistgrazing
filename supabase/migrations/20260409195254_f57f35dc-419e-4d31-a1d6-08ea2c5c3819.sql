
-- Add is_active column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Update handle_new_user to assign admin only to the very first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pending_invite RECORD;
  new_workspace_id UUID;
  sector UUID;
  user_count integer;
  auto_role app_role;
BEGIN
  -- Check for pending invite
  SELECT * INTO pending_invite
  FROM public.invites
  WHERE email = NEW.email AND status = 'pending'
  LIMIT 1;

  IF pending_invite IS NOT NULL THEN
    -- Invited user: join existing workspace
    INSERT INTO public.profiles (user_id, workspace_id, name, email)
    VALUES (NEW.id, pending_invite.workspace_id,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            NEW.email);

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, pending_invite.role);

    -- Assign sectors from invite
    IF pending_invite.sector_ids IS NOT NULL THEN
      FOREACH sector IN ARRAY pending_invite.sector_ids LOOP
        INSERT INTO public.user_sectors (user_id, sector_id) VALUES (NEW.id, sector);
      END LOOP;
    END IF;

    -- Mark invite as accepted
    UPDATE public.invites SET status = 'accepted' WHERE id = pending_invite.id;
  ELSE
    -- Organic signup: check if first user ever
    SELECT count(*) INTO user_count FROM public.profiles;

    IF user_count = 0 THEN
      auto_role := 'admin';
    ELSE
      auto_role := 'usuario';
    END IF;

    -- Create new workspace
    INSERT INTO public.workspaces (name) VALUES ('Meu Workspace') RETURNING id INTO new_workspace_id;
    INSERT INTO public.profiles (user_id, workspace_id, name, email)
    VALUES (NEW.id, new_workspace_id,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, auto_role);
    INSERT INTO public.collections (name, workspace_id, created_by) VALUES ('Meu Projeto', new_workspace_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;
