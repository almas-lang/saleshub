-- "Written off" status for invoices where the customer defaulted after
-- partial payment. Distinct from 'cancelled' (deal died before payment).
-- Paid installments and their income transactions are kept; the unpaid
-- remainder is marked written_off so it drops out of outstanding/overdue
-- stats and reminder crons (which only look at 'pending').
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'written_off';
ALTER TYPE installment_status ADD VALUE IF NOT EXISTS 'written_off';
