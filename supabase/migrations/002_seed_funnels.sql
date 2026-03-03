-- ============================================================
-- Seed default funnels and stages
-- ============================================================

-- VSL Lead Magnet Flow (default)
INSERT INTO funnels (id, name, description, sales_type, is_default, is_active)
VALUES (
  uuid_generate_v4(),
  'VSL Lead Magnet Flow',
  'Standard funnel for VSL-based lead magnet campaigns',
  'vsl',
  true,
  true
);

INSERT INTO funnel_stages (funnel_id, name, "order", color, is_terminal)
SELECT id, stage.name, stage."order", stage.color, stage.is_terminal
FROM funnels, (VALUES
  ('New Lead',      1, '#94A3B8', false),
  ('Contacted',     2, '#60A5FA', false),
  ('121 Booked',    3, '#A78BFA', false),
  ('121 Done',      4, '#F59E0B', false),
  ('Proposal Sent', 5, '#FB923C', false),
  ('Converted',     6, '#34D399', true),
  ('Lost',          7, '#EF4444', true)
) AS stage(name, "order", color, is_terminal)
WHERE funnels.sales_type = 'vsl';

-- Webinar Flow
INSERT INTO funnels (id, name, description, sales_type, is_default, is_active)
VALUES (
  uuid_generate_v4(),
  'Webinar Flow',
  'Funnel for webinar-based lead acquisition',
  'webinar',
  false,
  true
);

INSERT INTO funnel_stages (funnel_id, name, "order", color, is_terminal)
SELECT id, stage.name, stage."order", stage.color, stage.is_terminal
FROM funnels, (VALUES
  ('Registered',  1, '#94A3B8', false),
  ('Attended',    2, '#60A5FA', false),
  ('Interested',  3, '#A78BFA', false),
  ('Converted',   4, '#34D399', true),
  ('Lost',        5, '#EF4444', true)
) AS stage(name, "order", color, is_terminal)
WHERE funnels.sales_type = 'webinar';
