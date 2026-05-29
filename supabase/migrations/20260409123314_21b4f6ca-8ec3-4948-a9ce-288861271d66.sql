
DROP POLICY "Create notifications" ON public.notifications;
CREATE POLICY "Create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
