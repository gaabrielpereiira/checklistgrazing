
-- Add phone and whatsapp prefs to profiles
ALTER TABLE public.profiles ADD COLUMN phone TEXT;
ALTER TABLE public.profiles ADD COLUMN whatsapp_notifications BOOLEAN NOT NULL DEFAULT false;

-- Add archived flag to collections
ALTER TABLE public.collections ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own conversations" ON public.chat_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Create own conversations" ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own conversations" ON public.chat_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Delete own conversations" ON public.chat_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Add conversation_id to chat_messages (nullable for backward compat)
ALTER TABLE public.chat_messages ADD COLUMN conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE;
