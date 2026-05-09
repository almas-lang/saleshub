-- Add attachment and payment mode columns to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'UPI';

-- Add GST breakup columns for input GST tracking (Phase 5)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_rate NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_cgst NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_sgst NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_igst NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_gstin TEXT;

-- Add TDS columns (Phase 6)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tds_section TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tds_rate NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tds_amount NUMERIC;

-- Add TDS columns to invoices (Phase 6)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_section TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_rate NUMERIC;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_amount NUMERIC;

-- Add payment_mode to invoices for report generation
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_mode TEXT;
