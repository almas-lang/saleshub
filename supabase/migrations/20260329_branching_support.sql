-- ============================================================
-- Branching support for email drip campaigns
-- ============================================================

-- 1. email_steps: add branching columns
ALTER TABLE email_steps
  ADD COLUMN IF NOT EXISTS step_type TEXT NOT NULL DEFAULT 'send',
  ADD COLUMN IF NOT EXISTS next_step_id_yes UUID REFERENCES email_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_step_id_no  UUID REFERENCES email_steps(id) ON DELETE SET NULL;

-- 2. drip_enrollments: track by step ID (not just order)
ALTER TABLE drip_enrollments
  ADD COLUMN IF NOT EXISTS current_step_id UUID;

-- 3. email_campaigns: persist flow graph + ensure trigger_event exists
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS flow_data JSONB;

-- (trigger_event already exists on email_campaigns from initial schema)
