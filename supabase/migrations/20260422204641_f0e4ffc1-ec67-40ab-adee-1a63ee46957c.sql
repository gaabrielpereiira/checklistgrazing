-- 1. Restore the missing signup trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tighten RLS on api_keys_registry: only admins (not every workspace member)
DROP POLICY IF EXISTS "View workspace api keys" ON public.api_keys_registry;
CREATE POLICY "Admins view workspace api keys"
  ON public.api_keys_registry
  FOR SELECT
  TO authenticated
  USING (
    workspace_id = public.get_user_workspace_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. Recreate request triggers idempotently to guarantee no duplicates
DROP TRIGGER IF EXISTS on_new_request ON public.requests;
DROP TRIGGER IF EXISTS on_request_created ON public.requests;
DROP TRIGGER IF EXISTS on_request_status_change ON public.requests;

CREATE TRIGGER on_new_request
  AFTER INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_request();

CREATE TRIGGER on_request_status_change
  AFTER UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_status_change();