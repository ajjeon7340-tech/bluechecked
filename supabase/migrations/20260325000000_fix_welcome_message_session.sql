-- Fix welcome messages to create proper bidirectional sessions.
-- Session: sender_id=new_user (fan role), creator_id=diem_admin (creator role)
-- Welcome text goes into chat_lines as CREATOR role (from admin).
-- This way both parties see the conversation in their respective inboxes.

DROP FUNCTION IF EXISTS send_welcome_message(UUID, TEXT);

CREATE OR REPLACE FUNCTION send_welcome_message(p_creator_id UUID, p_content TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_diem_user_id UUID;
  v_already_sent INT;
  v_message_id UUID;
BEGIN
  SELECT id INTO v_diem_user_id
  FROM auth.users
  WHERE email = 'abe7340@gmail.com'
  LIMIT 1;

  IF v_diem_user_id IS NULL THEN
    RAISE NOTICE 'Diem account not found, skipping';
    RETURN;
  END IF;

  -- Check if welcome already sent (new_user as sender, admin as creator)
  SELECT COUNT(*) INTO v_already_sent
  FROM public.messages
  WHERE sender_id = p_creator_id AND creator_id = v_diem_user_id;

  -- Also check old format (admin as sender) for backwards compat
  IF v_already_sent = 0 THEN
    SELECT COUNT(*) INTO v_already_sent
    FROM public.messages
    WHERE sender_id = v_diem_user_id AND creator_id = p_creator_id;
  END IF;

  IF v_already_sent > 0 THEN
    RETURN;
  END IF;

  -- Create session: new user is sender (fan), Diem admin is creator
  INSERT INTO public.messages (sender_id, creator_id, content, amount, status, expires_at, is_read)
  VALUES (
    p_creator_id,
    v_diem_user_id,
    '',
    0,
    'REPLIED',
    NOW() + INTERVAL '365 days',
    false
  )
  RETURNING id INTO v_message_id;

  -- Add welcome text as a CREATOR chat line (from admin)
  INSERT INTO public.chat_lines (message_id, sender_id, role, content)
  VALUES (
    v_message_id,
    v_diem_user_id,
    'CREATOR',
    p_content
  );

  RAISE NOTICE 'Welcome message session created for %', p_creator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_welcome_message(UUID, TEXT) TO authenticated;

-- Same fix for fan welcome messages
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
  v_message_id UUID;
BEGIN
  SELECT id INTO v_diem_user_id
  FROM auth.users
  WHERE email = 'abe7340@gmail.com'
  LIMIT 1;

  IF v_diem_user_id IS NULL THEN
    RAISE NOTICE 'Diem account not found, skipping';
    RETURN;
  END IF;

  -- Check if welcome already sent (new format)
  SELECT COUNT(*) INTO v_already_sent
  FROM public.messages
  WHERE sender_id = p_fan_id AND creator_id = v_diem_user_id;

  -- Also check old format for backwards compat
  IF v_already_sent = 0 THEN
    SELECT COUNT(*) INTO v_already_sent
    FROM public.messages
    WHERE sender_id = v_diem_user_id AND creator_id = p_fan_id;
  END IF;

  IF v_already_sent > 0 THEN
    RETURN;
  END IF;

  -- Create session: fan is sender, Diem admin is creator
  INSERT INTO public.messages (sender_id, creator_id, content, amount, status, expires_at, is_read)
  VALUES (
    p_fan_id,
    v_diem_user_id,
    '',
    0,
    'REPLIED',
    NOW() + INTERVAL '365 days',
    false
  )
  RETURNING id INTO v_message_id;

  -- Add welcome text as a CREATOR chat line (from admin)
  INSERT INTO public.chat_lines (message_id, sender_id, role, content)
  VALUES (
    v_message_id,
    v_diem_user_id,
    'CREATOR',
    p_content
  );

  RAISE NOTICE 'Fan welcome message session created for %', p_fan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_fan_welcome_message(UUID, TEXT) TO authenticated;
