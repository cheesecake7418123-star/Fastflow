/*
# Fix task soft delete permissions

1. Add is_deleted, is_active columns to tasks if they don't exist
2. Update RLS policies to allow project members to soft-delete (UPDATE) tasks
*/

-- ─── ADD MISSING COLUMNS TO TASKS ─────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create index for soft-delete queries
DROP INDEX IF EXISTS tasks_is_deleted_idx;
CREATE INDEX tasks_is_deleted_idx ON tasks(is_deleted) WHERE is_deleted = false;

-- ─── DROP EXISTING POLICIES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

-- ─── CREATE UPDATE POLICY FOR TASKS ───────────────────────────────────────────
-- Soft delete uses UPDATE, so this policy must allow project members
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    -- Admin or manager
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    -- Task creator
    OR created_by = auth.uid()
    -- Task assignee
    OR assigned_to = auth.uid()
    -- Project creator
    OR EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = project_id 
        AND p.created_by = auth.uid()
    )
    -- Project member
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id 
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = project_id 
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id 
        AND pm.user_id = auth.uid()
    )
  );

-- ─── CREATE DELETE POLICY FOR TASKS ───────────────────────────────────────────
-- Hard delete should have same permissions as update
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = project_id 
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id 
        AND pm.user_id = auth.uid()
    )
  );

-- ─── CREATE TRIGGER TO AUTO-SET updated_by ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_task_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_by_trigger ON tasks;
CREATE TRIGGER tasks_updated_by_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_updated_by();