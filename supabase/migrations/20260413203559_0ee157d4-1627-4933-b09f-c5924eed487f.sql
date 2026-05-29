
-- Add time_options field to column_connections
ALTER TABLE public.column_connections ADD COLUMN IF NOT EXISTS time_options jsonb DEFAULT NULL;

-- Add UPDATE policy for column_connections (currently missing)
CREATE POLICY "Update connections by role"
ON public.column_connections FOR UPDATE TO authenticated
USING (
  (get_user_role() = ANY (ARRAY['admin'::app_role, 'gestor'::app_role]))
  AND (source_column_id IN (
    SELECT c.id FROM columns c
    JOIN collections col ON c.collection_id = col.id
    WHERE col.workspace_id = get_user_workspace_id()
  ))
);
