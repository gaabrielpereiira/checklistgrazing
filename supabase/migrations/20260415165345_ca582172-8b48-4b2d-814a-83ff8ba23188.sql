-- Function: returns user_ids of all members in the same teams as the current user.
-- Used by gestor role to see tasks of their team members.
-- Does NOT include the current user themselves (they already see their own tasks).

CREATE OR REPLACE FUNCTION public.get_team_member_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT tm2.user_id), '{}')
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm2.team_id = tm1.team_id
  WHERE tm1.user_id = auth.uid()
    AND tm2.user_id <> auth.uid()
$$;

-- Update tasks SELECT policy:
-- admin → sees all tasks in workspace
-- gestor → sees tasks in accessible collections + tasks assigned to team members
-- usuario → sees tasks in accessible collections (RLS already handles this)
DROP POLICY IF EXISTS "View tasks by role" ON public.tasks;
CREATE POLICY "View tasks by role" ON public.tasks FOR SELECT TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM public.collections
      WHERE workspace_id = get_user_workspace_id()
        AND user_has_collection_access(auth.uid(), id)
    )
    OR (
      -- Gestor can see tasks assigned to their team members
      get_user_role() = 'gestor'
      AND assignee_id = ANY(get_team_member_ids())
    )
  );