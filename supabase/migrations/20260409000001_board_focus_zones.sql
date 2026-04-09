ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS board_focus_desktop jsonb,
  ADD COLUMN IF NOT EXISTS board_focus_mobile jsonb;
