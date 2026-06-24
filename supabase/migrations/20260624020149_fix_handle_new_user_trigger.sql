
/*
# Fix handle_new_user trigger — safe role casting

The previous trigger would throw if raw_user_meta_data->>'role' was not a
valid user_role enum value, causing sign-up to fail with "unexpected_failure".
This version wraps the cast in a safe fallback so any bad/missing value
defaults to 'user' instead of crashing.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _role user_role := 'user';
BEGIN
  BEGIN
    _role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN others THEN
    _role := 'user';
  END;

  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    _role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
