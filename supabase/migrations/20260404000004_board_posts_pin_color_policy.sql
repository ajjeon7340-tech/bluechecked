-- Ensure is_pinned column exists (idempotent)
ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure note_color column exists (idempotent)
ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS note_color TEXT;

-- Explicit policy for creator to update metadata fields (pin, color, position)
DROP POLICY IF EXISTS "board_posts_creator_update" ON board_posts;
CREATE POLICY "board_posts_creator_update" ON board_posts
  FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());
