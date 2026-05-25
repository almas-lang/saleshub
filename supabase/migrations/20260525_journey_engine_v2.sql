-- Campaign Execution Engine v2 — schema foundation
-- Reuses existing tables (unified_steps = nodes, drip_enrollments = runs,
-- email_sends/wa_sends = outbox). Adds only what is missing.
-- Safe/idempotent: re-runnable.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Explicit edges — replaces the overloaded next_step_id_yes/no pointers.
--    Generic over the three step tables via campaign_type so one engine can
--    read any campaign's graph. `branch`: 'default' | 'yes' | 'no'.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_edges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('unified', 'email', 'whatsapp')),
  from_node     UUID NOT NULL,
  to_node       UUID NOT NULL,
  branch        TEXT NOT NULL DEFAULT 'default' CHECK (branch IN ('default', 'yes', 'no')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journey_edges_from
  ON journey_edges (campaign_id, campaign_type, from_node);
-- One edge per (source, branch, target): re-saving a campaign is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_journey_edges_edge
  ON journey_edges (campaign_id, from_node, branch, to_node);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Append-only execution audit log. Every routing/scheduling/send decision
--    lands here so "why did contact X get message Y at time Z" is one query.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_event_log (
  id            BIGSERIAL PRIMARY KEY,
  run_id        UUID,
  contact_id    UUID,
  campaign_id   UUID,
  campaign_type TEXT,
  node_id       UUID,
  type          TEXT NOT NULL,   -- cursor_created | node_entered | condition_evaluated
                                 -- | send_scheduled | message_enqueued | message_sent
                                 -- | message_failed | cursor_terminated | run_completed
  detail        JSONB,           -- inputs + result (e.g. {check, result, booking_at, hours, computed_at})
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jel_run ON journey_event_log (run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jel_campaign ON journey_event_log (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jel_contact ON journey_event_log (contact_id, created_at);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Cursor claim fields on runs (drip_enrollments). The worker claims ready
--    rows with SELECT ... FOR UPDATE SKIP LOCKED; claimed_until is a visibility
--    timeout so a crashed worker's rows become reclaimable.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE drip_enrollments ADD COLUMN IF NOT EXISTS claim_token   UUID;
ALTER TABLE drip_enrollments ADD COLUMN IF NOT EXISTS claimed_until TIMESTAMPTZ;
ALTER TABLE drip_enrollments ADD COLUMN IF NOT EXISTS engine        TEXT NOT NULL DEFAULT 'legacy';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Outbox semantics on the existing send tables: retry/backoff + exactly-once.
--    idempotency_key = run_id:node_id so a node never double-sends.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS attempts        INT NOT NULL DEFAULT 0;
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_sends_idem
  ON email_sends (idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE wa_sends ADD COLUMN IF NOT EXISTS attempts        INT NOT NULL DEFAULT 0;
ALTER TABLE wa_sends ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE wa_sends ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_sends_idem
  ON wa_sends (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 'dead' = retries exhausted (dead-letter). Enums, so ADD VALUE.
ALTER TYPE email_send_status ADD VALUE IF NOT EXISTS 'dead';
ALTER TYPE wa_send_status    ADD VALUE IF NOT EXISTS 'dead';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Per-campaign engine selector. Flip to 'v2' at cutover; legacy serves the rest.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE unified_campaigns ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE email_campaigns   ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE wa_campaigns      ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'legacy';

-- RLS: service role (cron/worker) already bypasses RLS; new tables get the same
-- policy shape as the rest of the schema.
ALTER TABLE journey_edges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_event_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated" ON journey_edges     FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role full access"     ON journey_edges     FOR ALL TO service_role  USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated" ON journey_event_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role full access"     ON journey_event_log FOR ALL TO service_role  USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
