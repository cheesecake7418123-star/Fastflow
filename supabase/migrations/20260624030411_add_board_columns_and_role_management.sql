
-- ─── BOARD COLUMNS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_columns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#6366f1',
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_columns_project_id_idx ON board_columns(project_id);

ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_columns_select" ON board_columns;
CREATE POLICY "board_columns_select" ON board_columns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "board_columns_insert" ON board_columns;
CREATE POLICY "board_columns_insert" ON board_columns FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = board_columns.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "board_columns_update" ON board_columns;
CREATE POLICY "board_columns_update" ON board_columns FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

DROP POLICY IF EXISTS "board_columns_delete" ON board_columns;
CREATE POLICY "board_columns_delete" ON board_columns FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

-- Add board_column_id to tasks (for custom column assignment)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_column_id uuid REFERENCES board_columns(id) ON DELETE SET NULL;

-- Allow admins to update any profile's role
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'));
