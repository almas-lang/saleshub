-- Split "is_customer" from lifecycle "type"
--
-- Until now, converting a prospect to a customer overwrote contacts.type to
-- 'customer', destroying the original prospect/lead classification and hiding
-- the contact from the Prospects space. This migration introduces an
-- is_customer flag so a contact can simultaneously be a prospect (their
-- origin) and a customer (their current relationship). Existing converted
-- rows are restored to type='prospect' (per product decision: conversion
-- only happens from the Prospects space in this app).
--
-- A trigger on drip_enrollments enforces the invariant that customers are
-- never enrolled in marketing campaigns, regardless of caller.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_customer boolean NOT NULL DEFAULT false;

-- Backfill: anyone currently typed 'customer' becomes a prospect-customer.
UPDATE contacts
SET is_customer = true,
    type = 'prospect'
WHERE type = 'customer';

CREATE INDEX IF NOT EXISTS idx_contacts_is_customer
  ON contacts(is_customer)
  WHERE is_customer = true;

-- Marketing-leak guard: prevent enrolling a customer in any drip campaign.
-- This catches anything an application-level filter forgets.
CREATE OR REPLACE FUNCTION block_customer_drip_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_is_customer boolean;
BEGIN
  SELECT is_customer INTO v_is_customer
  FROM contacts
  WHERE id = NEW.contact_id;

  IF v_is_customer THEN
    RAISE EXCEPTION 'Cannot enroll customer (contact_id=%) in drip campaign', NEW.contact_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_customer_drip_enrollment ON drip_enrollments;
CREATE TRIGGER trg_block_customer_drip_enrollment
  BEFORE INSERT ON drip_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION block_customer_drip_enrollment();
