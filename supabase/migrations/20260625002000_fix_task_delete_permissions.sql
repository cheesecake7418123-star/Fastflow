/*
# Fix task delete/update permissions

Soft-deleting a task uses UPDATE in the UI, so the live database must allow
project creators, project members, task creators, assignees, admins, and
managers to update the row.
*/

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid()
    )
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

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
      AND pm.role_in_project = 'owner'
  )
);
