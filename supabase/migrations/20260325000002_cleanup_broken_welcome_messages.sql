-- Clean up broken welcome messages created by the previous migration
-- (sender_id=user, creator_id=admin, content='', status='REPLIED')
-- These prevent new correct welcome messages from being created due to idempotency check.

DO $$
DECLARE
  v_diem_user_id UUID;
BEGIN
  SELECT id INTO v_diem_user_id
  FROM auth.users
  WHERE email = 'abe7340@gmail.com'
  LIMIT 1;

  IF v_diem_user_id IS NULL THEN
    RAISE NOTICE 'Diem account not found, skipping cleanup';
    RETURN;
  END IF;

  -- Delete broken welcome messages (where user is sender, admin is creator, content is empty)
  DELETE FROM public.chat_lines
  WHERE message_id IN (
    SELECT id FROM public.messages
    WHERE creator_id = v_diem_user_id
      AND content = ''
      AND amount = 0
      AND status = 'REPLIED'
  );

  DELETE FROM public.messages
  WHERE creator_id = v_diem_user_id
    AND content = ''
    AND amount = 0
    AND status = 'REPLIED';

  RAISE NOTICE 'Cleaned up broken welcome messages';
END;
$$;
