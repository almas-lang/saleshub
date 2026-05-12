-- Add plain_text flag to email_templates for sending without HTML wrapper
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS plain_text BOOLEAN NOT NULL DEFAULT false;

-- Also add to unified_steps so campaign steps can override
ALTER TABLE unified_steps ADD COLUMN IF NOT EXISTS plain_text BOOLEAN NOT NULL DEFAULT false;

-- Also add to email_steps
ALTER TABLE email_steps ADD COLUMN IF NOT EXISTS plain_text BOOLEAN NOT NULL DEFAULT false;
