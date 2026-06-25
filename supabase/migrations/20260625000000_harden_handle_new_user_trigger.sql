/*
# Harden auth signup trigger

This replaces the original profile-creation trigger with a version that:
- safely handles missing or invalid role metadata
- uses an explicit public search_path
- never blocks auth signup if profile creation fails
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role user_role := 'user';
  _full_name text := '';
BEGIN
  BEGIN
    IF NEW.raw_user_meta_data->>'role' = 'admin' THEN
      _role := 'admin';
    ELSIF NEW.raw_user_meta_data->>'role' = 'manager' THEN
      _role := 'manager';
    ELSE
      _role := 'user';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _role := 'user';
  END;

  BEGIN
    _full_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    );
  EXCEPTION WHEN OTHERS THEN
    _full_name := split_part(NEW.email, '@', 1);
  END;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, _full_name, _role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
