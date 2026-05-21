-- Add per-page form sections to booking pages.
-- Fields reference a section via FormField.sectionId; fields with no/unknown
-- sectionId render ungrouped (first, no header). Additive + defaulted so all
-- existing booking pages keep working unchanged.
ALTER TABLE booking_pages
  ADD COLUMN IF NOT EXISTS form_sections JSONB DEFAULT '[]';
