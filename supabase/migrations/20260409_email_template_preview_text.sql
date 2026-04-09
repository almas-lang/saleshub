-- Add preview_text column to email_templates
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS preview_text text;
