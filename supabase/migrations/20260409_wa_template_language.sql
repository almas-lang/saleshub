-- Add template language column to wa_steps so drip processor sends with correct language code
ALTER TABLE wa_steps ADD COLUMN IF NOT EXISTS wa_template_language TEXT DEFAULT 'en';

-- Fix existing steps that use en_US templates (xw_book_24, xw_book_48 are registered as en_US in Meta)
UPDATE wa_steps SET wa_template_language = 'en_US'
WHERE wa_template_name IN ('xw_book_24', 'xw_book_48');
