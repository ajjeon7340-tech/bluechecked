ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS is_added_to_chat boolean NOT NULL DEFAULT false;
