-- Board posts: fan-to-creator public Q&A board
-- Posts are shown as shadowed notes until creator replies.
-- Public posts become visible threads on reply; private stay between fan + creator only.

CREATE TABLE IF NOT EXISTS board_posts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fan_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  fan_name      TEXT        NOT NULL DEFAULT 'Anonymous Fan',
  fan_avatar_url TEXT,
  content       TEXT        NOT NULL,
  is_private    BOOLEAN     NOT NULL DEFAULT FALSE,
  reply         TEXT,
  reply_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS board_posts_creator_id_idx ON board_posts(creator_id);
CREATE INDEX IF NOT EXISTS board_posts_fan_id_idx ON board_posts(fan_id);

ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;

-- Public can see non-private posts that have been replied to
CREATE POLICY "board_posts_public_read" ON board_posts
  FOR SELECT
  USING (is_private = FALSE AND reply IS NOT NULL);

-- Fans can always see their own posts (pending or replied, public or private)
CREATE POLICY "board_posts_fan_own_read" ON board_posts
  FOR SELECT
  USING (fan_id = auth.uid());

-- Creator can see all posts sent to them
CREATE POLICY "board_posts_creator_read" ON board_posts
  FOR SELECT
  USING (creator_id = auth.uid());

-- Authenticated users can create posts (fan_id must match their auth uid)
CREATE POLICY "board_posts_fan_insert" ON board_posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND fan_id = auth.uid());

-- Creator can reply (update reply + reply_at columns only)
CREATE POLICY "board_posts_creator_reply" ON board_posts
  FOR UPDATE
  USING (creator_id = auth.uid());
