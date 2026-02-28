-- Add platform_fee column to withdrawals table
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0;
