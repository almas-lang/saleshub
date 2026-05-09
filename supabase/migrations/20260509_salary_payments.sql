-- Salary payments table for tracking employee salary disbursements
CREATE TABLE salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  employee_number TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT DEFAULT 'UPI',
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_salary_payments_date ON salary_payments(paid_date);
CREATE INDEX idx_salary_payments_employee ON salary_payments(employee_number);

-- Auto-update updated_at
CREATE TRIGGER set_salary_payments_updated_at
  BEFORE UPDATE ON salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
