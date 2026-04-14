ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS google_disconnect_reason TEXT,
  ADD COLUMN IF NOT EXISTS google_disconnected_at TIMESTAMPTZ;
