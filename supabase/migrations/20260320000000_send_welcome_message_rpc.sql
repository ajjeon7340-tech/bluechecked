-- RPC to send a welcome message from the Diem official account to a new creator.
-- Runs with SECURITY DEFINER so it can insert regardless of RLS policies.
CREATE OR REPLACE FUNCTION send_welcome_message(creator_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diem_user_id UUID;
  already_sent INT;
BEGIN
  -- Look up the Diem official account by email
  SELECT id INTO diem_user_id
  FROM profiles
  WHERE email = 'abe7340@gmail.com'
  LIMIT 1;

  IF diem_user_id IS NULL THEN
    RAISE NOTICE 'Diem account not found, skipping welcome message';
    RETURN;
  END IF;

  -- Idempotent: skip if already sent
  SELECT COUNT(*) INTO already_sent
  FROM messages
  WHERE sender_id = diem_user_id AND creator_id = send_welcome_message.creator_id;

  IF already_sent > 0 THEN
    RETURN;
  END IF;

  -- Insert the welcome message (10 free credits, 30-day expiry)
  INSERT INTO messages (sender_id, creator_id, content, amount, status, expires_at, is_read)
  VALUES (
    diem_user_id,
    send_welcome_message.creator_id,
    E'Hey! \U0001F44B Welcome to Diem — I''m so glad you''re here.\n\nHere''s how it works: fans pay to send you a message, and you reply when you''re ready. Once you reply and tap Collect, the credits hit your balance.\n\nYou can keep the conversation going as long as you like — reply as many times as you want. But remember, fans get one message per session, so your reply really matters to them.\n\nGo ahead and reply to this message to collect your first credits. Then head to Settings to set up your profile. Good luck! \U0001F680',
    10,
    'PENDING',
    NOW() + INTERVAL '30 days',
    false
  );
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION send_welcome_message(UUID) TO authenticated;
