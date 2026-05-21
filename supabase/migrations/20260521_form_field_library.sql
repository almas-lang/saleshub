-- Workspace-wide reusable form question library.
-- Each row stores a full FormField blob (minus its page-local id/sectionId, which
-- are reassigned when re-added to a page) so saved questions keep their type,
-- options, and "allow other" config. Shared across all team members.
CREATE TABLE IF NOT EXISTS form_field_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field JSONB NOT NULL,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_library_created ON form_field_library(created_at DESC);

ALTER TABLE form_field_library ENABLE ROW LEVEL SECURITY;

-- Mirror the rest of the schema: small trusted team, full access for authenticated users.
CREATE POLICY "Authenticated users full access" ON form_field_library
  FOR ALL USING (auth.role() = 'authenticated');
