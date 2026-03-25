-- Add profile_font column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_font TEXT;
