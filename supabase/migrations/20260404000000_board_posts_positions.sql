-- Add freeform position columns to board_posts so creator board layout persists
ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS position_x     FLOAT,
  ADD COLUMN IF NOT EXISTS position_y     FLOAT,
  ADD COLUMN IF NOT EXISTS display_order  INTEGER;
