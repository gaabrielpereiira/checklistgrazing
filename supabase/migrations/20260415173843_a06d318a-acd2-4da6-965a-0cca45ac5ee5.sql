-- Set all workspaces to hours mode (some may have been on days or null)
UPDATE public.workspaces SET planning_mode = 'hours' WHERE planning_mode IS NULL OR planning_mode = 'days';

-- Make hours the default going forward
ALTER TABLE public.workspaces ALTER COLUMN planning_mode SET DEFAULT 'hours';
ALTER TABLE public.workspaces ALTER COLUMN planning_mode SET NOT NULL;