-- Add attachment URL columns to board_posts for fan post and creator reply attachments
ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS attachment_url       TEXT,
  ADD COLUMN IF NOT EXISTS reply_attachment_url TEXT;
