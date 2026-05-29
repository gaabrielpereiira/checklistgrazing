
-- Add notification preferences JSONB to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';

-- Function to send WhatsApp notification via edge function (using pg_net)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_via_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile RECORD;
  prefs jsonb;
  notif_type text;
  should_send boolean := false;
  supabase_url text;
  anon_key text;
BEGIN
  -- Get user profile
  SELECT p.phone, p.whatsapp_notifications, p.notification_preferences, p.workspace_id
  INTO target_profile
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  IF target_profile IS NULL OR target_profile.phone IS NULL OR target_profile.phone = '' THEN
    RETURN NEW;
  END IF;

  prefs := COALESCE(target_profile.notification_preferences, '{}'::jsonb);
  notif_type := NEW.type::text;

  -- Check per-type preference first, then fall back to global toggle
  IF prefs ? notif_type THEN
    should_send := (prefs ->> notif_type) = 'whatsapp' OR (prefs ->> notif_type) = 'both';
  ELSE
    should_send := target_profile.whatsapp_notifications;
  END IF;

  IF NOT should_send THEN
    RETURN NEW;
  END IF;

  -- Call the whatsapp edge function via pg_net
  supabase_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- If settings not available, try environment approach
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RETURN NEW; -- Can't send without URL
  END IF;

  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/whatsapp',
    body := json_build_object(
      'action', 'send_notification',
      'phone', target_profile.phone,
      'message', COALESCE(NEW.message, 'Nova notificação no TaskAI'),
      'workspace_id', target_profile.workspace_id
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    )::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the notification insert if WhatsApp send fails
  RAISE WARNING 'WhatsApp notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_whatsapp ON public.notifications;
CREATE TRIGGER on_notification_whatsapp
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_via_whatsapp();
