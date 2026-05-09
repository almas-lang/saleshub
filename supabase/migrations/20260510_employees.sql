-- Employee master data — enter once, reuse in salary payments
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  employee_number TEXT NOT NULL UNIQUE,
  role TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_active ON employees(active);

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
