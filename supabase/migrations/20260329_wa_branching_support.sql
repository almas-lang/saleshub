-- ============================================================
-- Branching support for WhatsApp drip campaigns
-- ============================================================

-- 1. wa_steps: add branching columns (mirrors email_steps)
ALTER TABLE wa_steps
  ADD COLUMN IF NOT EXISTS step_type TEXT NOT NULL DEFAULT 'send',
  ADD COLUMN IF NOT EXISTS next_step_id_yes UUID REFERENCES wa_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_step_id_no  UUID REFERENCES wa_steps(id) ON DELETE SET NULL;

-- 2. wa_campaigns: persist flow graph (may already exist via JSONB flexibility)
ALTER TABLE wa_campaigns
  ADD COLUMN IF NOT EXISTS flow_data JSONB;
