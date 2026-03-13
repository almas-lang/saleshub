-- Add archived_at column to contacts
ALTER TABLE contacts ADD COLUMN archived_at TIMESTAMPTZ;

-- Partial index for efficient filtering
CREATE INDEX idx_contacts_archived_at
  ON contacts (archived_at)
  WHERE deleted_at IS NULL;

-- Bulk-archive all contacts created before 2026-01-01
UPDATE contacts
SET archived_at = NOW()
WHERE created_at < '2026-01-01'
  AND deleted_at IS NULL;
