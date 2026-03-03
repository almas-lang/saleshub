-- Add metadata JSONB column to contacts table
-- Stores arbitrary key-value pairs from CSV columns that don't map to dedicated fields
ALTER TABLE contacts ADD COLUMN metadata JSONB DEFAULT '{}';
