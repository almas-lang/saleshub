-- Add form_email column to store the email used in Calendly form
-- (may differ from the contact's primary email)
ALTER TABLE contact_form_responses ADD COLUMN form_email TEXT;
