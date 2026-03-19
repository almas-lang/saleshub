-- Invoice Installments / Partial Payments
-- Run this in Supabase SQL Editor

-- 1. New enum
CREATE TYPE installment_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

-- 2. New table
CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status installment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payment_gateway payment_gateway,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, installment_number)
);

CREATE INDEX idx_installments_status_due ON installments(status, due_date);

-- 3. Add has_installments column to invoices
ALTER TABLE invoices ADD COLUMN has_installments BOOLEAN DEFAULT FALSE;

-- 4. Add 'installment_reminder' to activity_type enum
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'installment_reminder';

-- 5. Enable RLS (match existing pattern)
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (matches other tables)
CREATE POLICY "Authenticated users can manage installments"
  ON installments FOR ALL
  USING (true)
  WITH CHECK (true);
