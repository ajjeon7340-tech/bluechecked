-- Add p_content parameter so TypeScript can pass a localized message
DROP FUNCTION IF EXISTS send_welcome_message(UUID);

CREATE OR REPLACE FUNCTION send_welcome_message(p_creator_id UUID, p_content TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_diem_user_id UUID;
  v_already_sent INT;
BEGIN
  SELECT id INTO v_diem_user_id
  FROM auth.users
  WHERE email = 'abe7340@gmail.com'
  LIMIT 1;

  IF v_diem_user_id IS NULL THEN
    RAISE NOTICE 'Diem account not found, skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_already_sent
  FROM public.messages
  WHERE sender_id = v_diem_user_id AND creator_id = p_creator_id;

  IF v_already_sent > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.messages (sender_id, creator_id, content, amount, status, expires_at, is_read)
  VALUES (
    v_diem_user_id,
    p_creator_id,
    p_content,
    10,
    'PENDING',
    NOW() + INTERVAL '30 days',
    false
  );

  RAISE NOTICE 'Welcome message sent to %', p_creator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_welcome_message(UUID, TEXT) TO authenticated;
