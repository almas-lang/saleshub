-- Unified campaigns: support mixed Email + WhatsApp steps in a single drip flow

CREATE TABLE IF NOT EXISTS unified_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type campaign_type NOT NULL DEFAULT 'drip',
  status campaign_status NOT NULL DEFAULT 'draft',
  trigger_event TEXT,
  stop_condition JSONB,
  audience_filter JSONB,
  flow_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unified_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES unified_campaigns(id) ON DELETE CASCADE,
  "order" INT NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'send',
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  delay_hours NUMERIC NOT NULL DEFAULT 0,

  -- Email fields
  subject TEXT,
  body_html TEXT,
  preview_text TEXT,

  -- WhatsApp fields
  wa_template_name TEXT,
  wa_template_language TEXT DEFAULT 'en',
  wa_template_params JSONB,
  wa_template_param_names JSONB,

  -- Branching
  condition JSONB,
  next_step_id_yes UUID REFERENCES unified_steps(id) ON DELETE SET NULL,
  next_step_id_no UUID REFERENCES unified_steps(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE unified_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON unified_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON unified_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON unified_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON unified_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
