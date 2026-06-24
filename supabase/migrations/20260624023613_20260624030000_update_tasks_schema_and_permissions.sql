/*
# Task Management Enhancements
1. Change date fields to timestamp for time support
2. Update task insert policy to allow project members to add tasks
*/

-- ─── CHANGE DATE FIELDS TO TIMESTAMPTZ ───────────────────────────────────────
ALTER TABLE tasks 
  ALTER COLUMN planned_start TYPE timestamptz USING planned_start::timestamptz,
  ALTER COLUMN planned_end TYPE timestamptz USING planned_end::timestamptz,
  ALTER COLUMN actual_start TYPE timestamptz USING actual_start::timestamptz,
  ALTER COLUMN actual_end TYPE timestamptz USING actual_end::timestamptz;

-- ─── UPDATE TASK INSERT POLICY FOR PROJECT MEMBERS ────────────────────────────
-- Drop the old policy
DROP POLICY IF EXISTS "tasks_insert" ON tasks;

-- Create new policy allowing project creators, project members, admins, and managers to insert
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (
  -- User is admin or manager
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  -- User is the project creator
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid()
  )
  -- User is a member of the project
  OR EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
  )
);

-- ─── UPDATE TASK UPDATE POLICY FOR PROJECT MEMBERS ────────────────────────────
DROP POLICY IF EXISTS "tasks_update" ON tasks;

CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    -- User is admin or manager
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    -- User is the task creator
    OR created_by = auth.uid()
    -- User is assigned to the task
    OR assigned_to = auth.uid()
    -- User is project creator
    OR EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid()
    )
    -- User is a project member
    OR EXISTS (
      SELECT 1 FROM project_members pm WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members pm WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
    )
  );

-- ─── UPDATE TASK DELETE POLICY FOR PROJECT MEMBERS ────────────────────────────
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (
  -- User is admin or manager
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  -- User is the task creator
  OR created_by = auth.uid()
  -- User is project creator
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid()
  )
  -- User is a project owner (has owner role in project)
  OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = project_id 
      AND pm.user_id = auth.uid() 
      AND pm.role_in_project = 'owner'
  )
);
