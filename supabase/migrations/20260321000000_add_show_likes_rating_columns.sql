-- Add show_likes and show_rating columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_likes BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_rating BOOLEAN NOT NULL DEFAULT TRUE;
