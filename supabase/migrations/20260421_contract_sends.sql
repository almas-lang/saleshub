-- Track contract emails sent to customers.
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'contract_sent';

CREATE TABLE IF NOT EXISTS contract_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sent_to_name TEXT NOT NULL,
  sent_to_email TEXT NOT NULL,
  sent_to_phone TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT
);

CREATE INDEX idx_contract_sends_contact ON contract_sends(contact_id, sent_at DESC);
