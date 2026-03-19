-- Add test_mode column to stripe_accounts so we can store separate accounts for test vs live
ALTER TABLE stripe_accounts ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT TRUE;

-- Drop old unique constraint on user_id (one per user) and replace with one per user+mode
ALTER TABLE stripe_accounts DROP CONSTRAINT IF EXISTS stripe_accounts_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS stripe_accounts_user_mode_idx ON stripe_accounts (user_id, test_mode);
