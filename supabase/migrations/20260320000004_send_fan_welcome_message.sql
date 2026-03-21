-- Send a welcome message from Diem to new fan accounts
DROP FUNCTION IF EXISTS send_fan_welcome_message(UUID, TEXT);

CREATE OR REPLACE FUNCTION send_fan_welcome_message(p_fan_id UUID, p_content TEXT)
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

  -- Idempotent: skip if already sent to this fan
  SELECT COUNT(*) INTO v_already_sent
  FROM public.messages
  WHERE sender_id = v_diem_user_id AND creator_id = p_fan_id;

  IF v_already_sent > 0 THEN
    RETURN;
  END IF;

  -- amount=0 (no credits), status=REPLIED (no action needed), is_read=true (no badge)
  INSERT INTO public.messages (sender_id, creator_id, content, amount, status, expires_at, is_read)
  VALUES (
    v_diem_user_id,
    p_fan_id,
    p_content,
    0,
    'REPLIED',
    NOW() + INTERVAL '365 days',
    true
  );

  RAISE NOTICE 'Fan welcome message sent to %', p_fan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_fan_welcome_message(UUID, TEXT) TO authenticated;
