-- Add scheduling support to contract_sends.
ALTER TABLE contract_sends
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE contract_sends
  DROP CONSTRAINT IF EXISTS contract_sends_status_check;

ALTER TABLE contract_sends
  ADD CONSTRAINT contract_sends_status_check
  CHECK (status IN ('sent', 'failed', 'scheduled', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_contract_sends_scheduled
  ON contract_sends(contact_id, scheduled_at)
  WHERE status = 'scheduled';
