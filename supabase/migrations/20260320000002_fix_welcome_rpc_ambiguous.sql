DROP FUNCTION IF EXISTS send_welcome_message(UUID);

CREATE OR REPLACE FUNCTION send_welcome_message(p_creator_id UUID)
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
    E'Hey! \U0001F44B Welcome to Diem — I''m so glad you''re here.\n\nHere''s how it works: fans pay to send you a message, and you reply when you''re ready. Once you reply and tap Collect, the credits hit your balance.\n\nYou can keep the conversation going as long as you like — reply as many times as you want. But remember, fans get one message per session, so your reply really matters to them.\n\nGo ahead and reply to this message to collect your first credits. Then head to Settings to set up your profile. Good luck! \U0001F680',
    10,
    'PENDING',
    NOW() + INTERVAL '30 days',
    false
  );

  RAISE NOTICE 'Welcome message sent to %', p_creator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_welcome_message(UUID) TO authenticated;
