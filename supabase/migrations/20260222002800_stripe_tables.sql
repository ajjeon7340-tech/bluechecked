-- Stripe Connect accounts linked to users
CREATE TABLE IF NOT EXISTS stripe_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    onboarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Withdrawal history
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    amount_usd NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    stripe_transfer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can read their own Stripe account
CREATE POLICY "Users can view own stripe account"
    ON stripe_accounts FOR SELECT
    USING (auth.uid() = user_id);

-- Users can read their own withdrawals
CREATE POLICY "Users can view own withdrawals"
    ON withdrawals FOR SELECT
    USING (auth.uid() = creator_id);

-- Only service role (edge functions) can insert/update these tables
-- No INSERT/UPDATE policies for authenticated users since edge functions use service role
