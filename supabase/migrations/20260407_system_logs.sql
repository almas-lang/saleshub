-- System logs table for in-app debugging
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  source TEXT NOT NULL,          -- e.g. 'drip-processor', 'whatsapp-api', 'auto-enroll'
  message TEXT NOT NULL,
  metadata JSONB,                -- structured context (campaign_id, contact_id, error details, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for filtering by source and level
CREATE INDEX idx_system_logs_source ON system_logs(source);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);

-- Auto-cleanup: keep only last 30 days of logs
-- (run via pg_cron or manual cleanup)
