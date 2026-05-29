-- Agenda o digest diário de email todo dia útil às 8h BRT (11h UTC)
-- Requer pg_cron e pg_net já habilitados (migration 20260409140857)

SELECT cron.schedule(
  'daily-email-digest',
  '0 11 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://ubtslbfubnlqpokgfcwc.supabase.co/functions/v1/notify-daily',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidHNsYmZ1Ym5scXBva2dmY3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTczNzAsImV4cCI6MjA5NTYzMzM3MH0.OiZQPS1L0UPKi4v3c40U0-x9k1Jge1ezzpWGTkbf8G0"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
