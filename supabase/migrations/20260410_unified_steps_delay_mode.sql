-- Add delay_mode column to unified_steps for "before_booking" scheduling
ALTER TABLE unified_steps ADD COLUMN IF NOT EXISTS delay_mode TEXT NOT NULL DEFAULT 'after_previous';
