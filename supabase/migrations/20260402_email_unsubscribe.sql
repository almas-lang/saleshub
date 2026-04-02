-- Add email unsubscribe support to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMPTZ;

CREATE INDEX idx_contacts_email_unsubscribed ON contacts(email_unsubscribed_at)
  WHERE email_unsubscribed_at IS NOT NULL;
