-- Store manual overrides for paid traffic metrics.
-- Keeps both the original (auto-computed) and user-corrected values.
CREATE TABLE IF NOT EXISTS paid_traffic_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'meta',
  field TEXT NOT NULL,          -- column name: 'leads', 'apps', 'calls', 'sales', 'revenue', 'cash', etc.
  original_value NUMERIC,       -- what the system computed
  override_value NUMERIC NOT NULL, -- what the user entered
  note TEXT,                    -- optional reason for override
  updated_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, platform, field)
);
