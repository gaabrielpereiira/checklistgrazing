
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'usuario');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Workspaces
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Meu Workspace',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'usuario',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function to get user's workspace_id
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Collections
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Columns
CREATE TABLE public.columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE
);
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id),
  priority task_priority NOT NULL DEFAULT 'media',
  due_date DATE,
  linked_task_id UUID REFERENCES public.tasks(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Subtasks
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0
);
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + workspace on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (name) VALUES ('Meu Workspace') RETURNING id INTO new_workspace_id;
  INSERT INTO public.profiles (user_id, workspace_id, name, email)
    VALUES (NEW.id, new_workspace_id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  -- Create default collection
  INSERT INTO public.collections (name, workspace_id, created_by) VALUES ('Meu Projeto', new_workspace_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Workspaces: users see their own workspace
CREATE POLICY "Users can view their workspace" ON public.workspaces FOR SELECT TO authenticated
  USING (id = public.get_user_workspace_id());

CREATE POLICY "Users can update their workspace" ON public.workspaces FOR UPDATE TO authenticated
  USING (id = public.get_user_workspace_id());

-- Profiles: users see workspace members, edit own
CREATE POLICY "Users can view workspace profiles" ON public.profiles FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Collections: workspace-scoped
CREATE POLICY "View workspace collections" ON public.collections FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Create workspace collections" ON public.collections FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Update workspace collections" ON public.collections FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Delete workspace collections" ON public.collections FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Columns: through collection's workspace
CREATE POLICY "View columns" ON public.columns FOR SELECT TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

CREATE POLICY "Create columns" ON public.columns FOR INSERT TO authenticated
  WITH CHECK (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

CREATE POLICY "Update columns" ON public.columns FOR UPDATE TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

CREATE POLICY "Delete columns" ON public.columns FOR DELETE TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

-- Tasks: through collection's workspace
CREATE POLICY "View tasks" ON public.tasks FOR SELECT TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

CREATE POLICY "Create tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

CREATE POLICY "Update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

CREATE POLICY "Delete tasks" ON public.tasks FOR DELETE TO authenticated
  USING (collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id()));

-- Subtasks: through task's collection
CREATE POLICY "View subtasks" ON public.subtasks FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

CREATE POLICY "Create subtasks" ON public.subtasks FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

CREATE POLICY "Update subtasks" ON public.subtasks FOR UPDATE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

CREATE POLICY "Delete subtasks" ON public.subtasks FOR DELETE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE collection_id IN (SELECT id FROM public.collections WHERE workspace_id = public.get_user_workspace_id())));

-- Chat messages: user's own
CREATE POLICY "View own chat messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Create own chat messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
