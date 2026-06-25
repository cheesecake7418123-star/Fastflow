/*
# Avoid direct RLS-sensitive project lookups in task policies

Task updates/deletes should be allowed when the current user:
- is admin or manager
- created the task
- is assigned to the task
- created the project
- belongs to the project as a member

The helper below runs as SECURITY DEFINER so the policy can check project
ownership/membership without tripping over caller-side RLS on projects.
*/

CREATE OR REPLACE FUNCTION public.user_can_access_project(project_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects
      WHERE id = project_uuid
        AND created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = project_uuid
        AND user_id = auth.uid()
    );
END;
$$;

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.user_can_access_project(project_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  OR created_by = auth.uid()
  OR public.user_can_access_project(project_id)
);
