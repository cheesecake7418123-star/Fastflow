
/*
# Task Management System — Schema Part 1
Creates enums, profiles, projects (without member-check policies), project_members,
tasks, task_messages, and task_history tables.
*/

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_member_role AS ENUM ('owner', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  role        user_role NOT NULL DEFAULT 'user',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── PROJECTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#3B82F6',
  description text,
  created_by  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Temporary open policies — will be replaced in part 2 after project_members exists
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- ─── PROJECT MEMBERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_project  project_member_role NOT NULL DEFAULT 'member',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_select" ON project_members;
CREATE POLICY "project_members_select" ON project_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "project_members_insert" ON project_members;
CREATE POLICY "project_members_insert" ON project_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "project_members_update" ON project_members;
CREATE POLICY "project_members_update" ON project_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "project_members_delete" ON project_members;
CREATE POLICY "project_members_delete" ON project_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── TASKS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id  uuid REFERENCES tasks(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  status          task_status NOT NULL DEFAULT 'todo',
  planned_start   date,
  planned_end     date,
  actual_start    date,
  actual_end      date,
  estimated_hours numeric(10,2),
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks(assigned_to);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- ─── TASK MESSAGES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_messages_task_id_idx ON task_messages(task_id);

ALTER TABLE task_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_messages_select" ON task_messages;
CREATE POLICY "task_messages_select" ON task_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_messages_insert" ON task_messages;
CREATE POLICY "task_messages_insert" ON task_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "task_messages_update" ON task_messages;
CREATE POLICY "task_messages_update" ON task_messages FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "task_messages_delete" ON task_messages;
CREATE POLICY "task_messages_delete" ON task_messages FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- ─── TASK HISTORY ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field_name  text NOT NULL,
  old_value   text,
  new_value   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_history_task_id_idx ON task_history(task_id);

ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_history_select" ON task_history;
CREATE POLICY "task_history_select" ON task_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_history_insert" ON task_history;
CREATE POLICY "task_history_insert" ON task_history FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "task_history_update" ON task_history;
CREATE POLICY "task_history_update" ON task_history FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "task_history_delete" ON task_history;
CREATE POLICY "task_history_delete" ON task_history FOR DELETE TO authenticated USING (false);
