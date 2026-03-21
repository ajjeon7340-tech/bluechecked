-- Add show_bio column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_bio BOOLEAN NOT NULL DEFAULT TRUE;
