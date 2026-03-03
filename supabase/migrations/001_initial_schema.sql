-- ============================================================
-- SalesHub — Full Database Schema
-- Run this in Supabase SQL Editor (Settings → SQL Editor → New Query)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE contact_type AS ENUM ('prospect', 'customer', 'lead');
CREATE TYPE account_type AS ENUM ('individual', 'business');
CREATE TYPE work_experience AS ENUM ('fresher', '<2_years', '3-5_years', '5-10_years', '10+_years');
CREATE TYPE financial_readiness AS ENUM ('ready', 'careful_but_open', 'not_ready');
CREATE TYPE urgency_level AS ENUM ('right_now', 'within_90_days', 'more_than_90_days');
CREATE TYPE sales_type AS ENUM ('vsl', 'webinar', 'workshop', 'short_course', 'direct_outreach', 'custom');
CREATE TYPE activity_type AS ENUM ('note', 'call', 'email_sent', 'email_opened', 'wa_sent', 'wa_delivered', 'wa_read', 'stage_change', 'booking_created', 'payment_received', 'invoice_sent', 'form_submitted');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'completed', 'overdue', 'cancelled');
CREATE TYPE task_type AS ENUM ('follow_up', 'call', 'email', 'general');
CREATE TYPE campaign_type AS ENUM ('drip', 'one_time', 'newsletter');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE email_send_status AS ENUM ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
CREATE TYPE wa_send_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE booking_outcome AS ENUM ('qualified', 'not_qualified', 'needs_follow_up', 'converted');
CREATE TYPE invoice_type AS ENUM ('estimate', 'invoice');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_gateway AS ENUM ('cashfree', 'stripe', 'manual');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE team_role AS ENUM ('admin', 'sales', 'marketing', 'viewer');

-- ============================================================
-- HELPER: Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: team_members
-- Users of SalesHub (must be created before contacts for FK)
-- ============================================================

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,           -- Links to Supabase Auth user
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role team_role NOT NULL DEFAULT 'sales',
  avatar_url TEXT,
  google_calendar_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: companies (Phase 4+ — B2B support)
-- ============================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  gst_number TEXT,
  website TEXT,
  industry TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: funnels
-- Pipeline templates (VSL, Webinar, etc.)
-- ============================================================

CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sales_type sales_type NOT NULL DEFAULT 'vsl',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER funnels_updated_at
  BEFORE UPDATE ON funnels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: funnel_stages
-- Stages within a funnel
-- ============================================================

CREATE TABLE funnel_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94A3B8',
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  auto_action JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funnel_stages_funnel ON funnel_stages(funnel_id, "order");

-- ============================================================
-- TABLE: contacts
-- Central table — every person (prospect or customer)
-- ============================================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type contact_type NOT NULL DEFAULT 'prospect',
  account_type account_type NOT NULL DEFAULT 'individual',
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  assigned_to UUID REFERENCES team_members(id),
  funnel_id UUID REFERENCES funnels(id),
  current_stage_id UUID REFERENCES funnel_stages(id),
  tags TEXT[] DEFAULT '{}',
  company_name TEXT,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_funnel ON contacts(funnel_id, current_stage_id);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC);
CREATE INDEX idx_contacts_deleted ON contacts(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: contact_form_responses
-- Qualifying form answers (Calendly-replacement form)
-- ============================================================

CREATE TABLE contact_form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  booking_id UUID,                     -- FK added after bookings table created
  work_experience work_experience,
  "current_role" TEXT,
  key_challenge TEXT,
  desired_salary TEXT,
  blocker TEXT,
  financial_readiness financial_readiness,
  urgency urgency_level,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_responses_contact ON contact_form_responses(contact_id);

-- ============================================================
-- TABLE: activities
-- Universal activity log / timeline
-- ============================================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES team_members(id),
  type activity_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_contact ON activities(contact_id, created_at DESC);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_type ON activities(type);

-- ============================================================
-- TABLE: tasks
-- Follow-up reminders and action items
-- ============================================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES team_members(id),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  type task_type NOT NULL DEFAULT 'follow_up',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due ON tasks(due_at) WHERE status = 'pending';
CREATE INDEX idx_tasks_contact ON tasks(contact_id);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: email_templates
-- Reusable email templates
-- ============================================================

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: email_campaigns
-- One-time mass emails and drip sequences
-- ============================================================

CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type campaign_type NOT NULL DEFAULT 'one_time',
  status campaign_status NOT NULL DEFAULT 'draft',
  trigger_event TEXT,
  stop_condition JSONB,
  audience_filter JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: email_steps
-- Individual emails within a drip campaign
-- ============================================================

CREATE TABLE email_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  "order" INT NOT NULL,
  delay_hours INT NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  condition JSONB,
  template_id UUID REFERENCES email_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_steps_campaign ON email_steps(campaign_id, "order");

-- ============================================================
-- TABLE: email_sends
-- Individual email delivery records with tracking
-- ============================================================

CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id),
  step_id UUID REFERENCES email_steps(id),
  status email_send_status NOT NULL DEFAULT 'queued',
  resend_message_id TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_sends_contact ON email_sends(contact_id);
CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX idx_email_sends_status ON email_sends(status);

-- ============================================================
-- TABLE: wa_templates
-- Mirrors approved Meta WhatsApp templates
-- ============================================================

CREATE TABLE wa_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  category TEXT,
  body_text TEXT,
  header_text TEXT,
  footer_text TEXT,
  buttons JSONB,
  meta_template_id TEXT,               -- Meta's template ID
  status TEXT DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER wa_templates_updated_at
  BEFORE UPDATE ON wa_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: wa_campaigns
-- WhatsApp campaigns and drip sequences
-- ============================================================

CREATE TABLE wa_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type campaign_type NOT NULL DEFAULT 'one_time',
  status campaign_status NOT NULL DEFAULT 'draft',
  trigger_event TEXT,
  stop_condition JSONB,
  audience_filter JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER wa_campaigns_updated_at
  BEFORE UPDATE ON wa_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: wa_steps
-- Individual steps within a WhatsApp drip sequence
-- ============================================================

CREATE TABLE wa_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
  "order" INT NOT NULL,
  delay_hours INT NOT NULL DEFAULT 0,
  wa_template_name TEXT NOT NULL,
  wa_template_params JSONB DEFAULT '{}',
  condition JSONB,
  template_id UUID REFERENCES wa_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_steps_campaign ON wa_steps(campaign_id, "order");

-- ============================================================
-- TABLE: wa_sends
-- Individual WhatsApp message delivery records
-- ============================================================

CREATE TABLE wa_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES wa_campaigns(id),
  step_id UUID REFERENCES wa_steps(id),
  status wa_send_status NOT NULL DEFAULT 'queued',
  wa_message_id TEXT,                  -- Meta's message ID
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_sends_contact ON wa_sends(contact_id);
CREATE INDEX idx_wa_sends_campaign ON wa_sends(campaign_id);
CREATE INDEX idx_wa_sends_status ON wa_sends(status);

-- ============================================================
-- TABLE: booking_pages
-- Calendly replacement — public booking pages
-- ============================================================

CREATE TABLE booking_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 45,
  form_fields JSONB DEFAULT '[]',
  availability_rules JSONB DEFAULT '{}',
  google_calendar_id TEXT,
  assigned_to UUID[] DEFAULT '{}',
  confirmation_email BOOLEAN DEFAULT true,
  confirmation_wa BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER booking_pages_updated_at
  BEFORE UPDATE ON booking_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: bookings
-- Individual booked meetings
-- ============================================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_page_id UUID REFERENCES booking_pages(id),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES team_members(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  google_event_id TEXT,
  meet_link TEXT,
  notes TEXT,
  outcome booking_outcome,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_contact ON bookings(contact_id);
CREATE INDEX idx_bookings_assigned ON bookings(assigned_to);
CREATE INDEX idx_bookings_starts ON bookings(starts_at);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add the FK from contact_form_responses to bookings
ALTER TABLE contact_form_responses
  ADD CONSTRAINT fk_form_responses_booking
  FOREIGN KEY (booking_id) REFERENCES bookings(id);

-- ============================================================
-- TABLE: invoices
-- Estimates and GST invoices
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type invoice_type NOT NULL DEFAULT 'invoice',
  status invoice_status NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',   -- [{description, qty, rate, amount, sac_code}]
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_number TEXT,
  due_date DATE,
  payment_gateway payment_gateway,
  payment_link TEXT,
  payment_id TEXT,
  paid_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_day INT CHECK (recurrence_day BETWEEN 1 AND 28),
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_contact ON invoices(contact_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: transactions (Phase 4 — Finance module)
-- All money in and out
-- ============================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type transaction_type NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  invoice_id UUID REFERENCES invoices(id),
  contact_id UUID REFERENCES contacts(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  gst_applicable BOOLEAN DEFAULT false,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: notifications
-- In-app notifications
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,                           -- Deep link within app (e.g., /prospects/uuid)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ============================================================
-- TABLE: customer_programs
-- Tracks mentorship/program enrollment per customer
-- ============================================================

CREATE TABLE customer_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  sessions_total INT,
  sessions_completed INT DEFAULT 0,
  mentor_id UUID REFERENCES team_members(id),
  status TEXT DEFAULT 'active',
  amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_programs_contact ON customer_programs(contact_id);

CREATE TRIGGER customer_programs_updated_at
  BEFORE UPDATE ON customer_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: files
-- Voice notes, documents attached to contacts
-- ============================================================

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES team_members(id),
  file_name TEXT NOT NULL,
  file_type TEXT,                      -- MIME type
  file_size INT,                       -- Bytes
  storage_path TEXT NOT NULL,          -- Supabase Storage path
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_contact ON files(contact_id);

-- ============================================================
-- DONE! All 23 tables created.
-- Next: Run 002_seed_funnels.sql to create default funnels.
-- ============================================================
