-- WhatsApp Chat Features: delete messages + archive chats + named template params
-- 2026-04-06

-- 1. Soft-delete for messages
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Archive chats (WA-specific, separate from contacts)
CREATE TABLE IF NOT EXISTS wa_archived_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id)
);

ALTER TABLE wa_archived_chats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage archived chats"
    ON wa_archived_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Named template parameter support for drip campaigns
ALTER TABLE wa_steps ADD COLUMN IF NOT EXISTS wa_template_param_names TEXT[];

-- 4. Allow fractional delay_hours (40 mins = 0.666 hours)
ALTER TABLE wa_steps ALTER COLUMN delay_hours TYPE DOUBLE PRECISION;
