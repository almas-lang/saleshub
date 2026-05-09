-- Bank transactions for reconciliation
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  balance NUMERIC,
  reference TEXT,
  bank_name TEXT DEFAULT 'HDFC',
  month TEXT NOT NULL, -- YYYY-MM
  batch_id UUID,
  reconciled BOOLEAN DEFAULT FALSE,
  matched_type TEXT, -- 'invoice' | 'expense' | 'salary' | null
  matched_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_txn_month ON bank_transactions(month);
CREATE INDEX idx_bank_txn_reconciled ON bank_transactions(reconciled);

-- Reconciliation batches
CREATE TABLE reconciliation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  year INT NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed'
  total_count INT DEFAULT 0,
  matched_count INT DEFAULT 0,
  unmatched_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recon_batch_month ON reconciliation_batches(month, year);
