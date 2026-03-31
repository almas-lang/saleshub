-- ============================================================
-- wa_messages: Bidirectional WhatsApp message store for chat inbox
-- ============================================================

-- Direction enum
CREATE TYPE wa_message_direction AS ENUM ('inbound', 'outbound');

-- Main messages table
CREATE TABLE wa_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction wa_message_direction NOT NULL,
  body TEXT,                              -- Message text content
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, video, document, audio, sticker, etc.
  wa_message_id TEXT,                     -- Meta's message ID
  status TEXT DEFAULT 'sent',             -- sent, delivered, read, failed (outbound only)
  metadata JSONB,                         -- Extra data (media url, template name, error info)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_messages_contact ON wa_messages(contact_id);
CREATE INDEX idx_wa_messages_contact_created ON wa_messages(contact_id, created_at DESC);
CREATE INDEX idx_wa_messages_wa_id ON wa_messages(wa_message_id);

-- Add wa_reply activity type for tracking replies in timeline
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'wa_reply';

-- RLS: authenticated users can read/insert wa_messages
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wa_messages"
  ON wa_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert wa_messages"
  ON wa_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update wa_messages"
  ON wa_messages FOR UPDATE
  TO authenticated
  USING (true);

-- Service role (admin) bypass
CREATE POLICY "Service role full access to wa_messages"
  ON wa_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
