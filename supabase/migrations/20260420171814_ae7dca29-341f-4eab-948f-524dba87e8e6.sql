ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS ai_allowed_phone text;

COMMENT ON COLUMN public.whatsapp_instances.ai_allowed_phone IS 'When set, the AI will only respond to messages from this phone number (digits only, with or without country code). When NULL, AI responds to any registered user.';