/*
# Fix task RLS - use SECURITY DEFINER functions to bypass RLS on referenced tables

The issue: When tasks UPDATE policy runs subqueries on project_members,
those subqueries are subject to RLS on project_members, which may block
the query from seeing membership records.

Solution: Use SECURITY DEFINER functions that run with elevated privileges
to check project membership without RLS interference.
*/

-- ─── CREATE SECURITY DEFINER FUNCTIONS ───────────────────────────────────────

-- Check if user has access to a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_project_access(check_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN
    -- User is admin or manager
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    -- User is project creator
    OR EXISTS (
      SELECT 1 FROM projects WHERE id = check_project_id AND created_by = auth.uid()
    )
    -- User is a member of the project (bypass RLS on project_members)
    OR EXISTS (
      SELECT 1 FROM project_members WHERE project_id = check_project_id AND user_id = auth.uid()
    );
END;
$$;

-- ─── DROP AND RECREATE TASK POLICIES ──────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

-- Update policy using the helper function
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    -- Admin or manager
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    -- Task creator
    OR created_by = auth.uid()
    -- Task assignee
    OR assigned_to = auth.uid()
    -- Has project access (creator or member)
    OR public.user_has_project_access(project_id)
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.user_has_project_access(project_id)
  );

-- Delete policy - same permissions as update
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR public.user_has_project_access(project_id)
  );

-- ─── GRANT EXECUTE ON HELPER FUNCTION ────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_has_project_access TO authenticated;