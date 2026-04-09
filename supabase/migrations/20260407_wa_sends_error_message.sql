-- Add error_message column to wa_sends so we can see WHY messages failed
ALTER TABLE wa_sends ADD COLUMN IF NOT EXISTS error_message TEXT;
