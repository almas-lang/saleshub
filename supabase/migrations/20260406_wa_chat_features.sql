-- WhatsApp Chat Features: delete messages + archive chats
-- 2026-04-06

-- 1. Soft-delete for messages
ALTER TABLE wa_messages ADD COLUMN deleted_at TIMESTAMPTZ;

-- 2. Archive chats (WA-specific, separate from contacts)
CREATE TABLE wa_archived_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id)
);

ALTER TABLE wa_archived_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage archived chats"
  ON wa_archived_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);
