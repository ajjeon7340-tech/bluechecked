-- Returns the user ID for the Diem official account (abe7340@gmail.com)
-- Callable by anon & authenticated so the demo button works for logged-out visitors

CREATE OR REPLACE FUNCTION get_diem_user_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = 'abe7340@gmail.com' LIMIT 1;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_diem_user_id() TO anon, authenticated;
