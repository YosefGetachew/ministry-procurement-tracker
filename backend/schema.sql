-- Ministry of Agriculture Procurement Tracking System
-- Rebuilt against SDD v1.2 (Project -> Procurement Plan -> Procurement Activity ->
-- Activity Stage -> Contract/Payment, with Director review + committee voting).
-- This is a breaking rewrite of the old flat Plan/Procurement model: run this once
-- against a fresh (or disposable-demo-data) database, e.g.:
--   psql -U postgres -d moa_procurement -f schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS committee_votes CASCADE;
DROP TABLE IF EXISTS management_decisions CASCADE;
DROP TABLE IF EXISTS committee_members CASCADE;
DROP TABLE IF EXISTS management_members CASCADE;
DROP TABLE IF EXISTS leadership_registry CASCADE;
DROP TABLE IF EXISTS activity_revisions CASCADE;
DROP TABLE IF EXISTS activity_stages CASCADE;
DROP TABLE IF EXISTS procurement_activities CASCADE;
DROP TABLE IF EXISTS procurement_plans CASCADE;
DROP TABLE IF EXISTS project_assignments CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS lookup_options CASCADE;
DROP TABLE IF EXISTS sectors CASCADE;
DROP TABLE IF EXISTS stage_history CASCADE;
DROP TABLE IF EXISTS procurements CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  phone                 VARCHAR(30) DEFAULT '',
  biography             TEXT DEFAULT '',
  password_hash         TEXT NOT NULL,
  role                  VARCHAR(20) NOT NULL CHECK (role IN ('officer', 'director', 'committee', 'management', 'admin')),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  must_change_password  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sectors (
  id                    SERIAL PRIMARY KEY,
  code                  VARCHAR(20) NOT NULL UNIQUE,
  name                  TEXT NOT NULL UNIQUE,
  description           TEXT DEFAULT '',
  structure_type        VARCHAR(30) NOT NULL DEFAULT 'sector' CHECK (structure_type IN ('sector', 'ceo_office', 'minister_office_head')),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leadership_registry (
  id                    SERIAL PRIMARY KEY,
  position              VARCHAR(30) NOT NULL CHECK (position IN ('state_minister', 'minister', 'ceo', 'minister_office_head')),
  sector_id             INTEGER REFERENCES sectors(id) ON DELETE RESTRICT,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  phone                 VARCHAR(30) NOT NULL,
  biography             TEXT DEFAULT '',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((position = 'state_minister' AND sector_id IS NOT NULL) OR (position <> 'state_minister' AND sector_id IS NULL))
);
CREATE UNIQUE INDEX uq_leadership_active_seat ON leadership_registry(position, COALESCE(sector_id, 0)) WHERE is_active;

CREATE TABLE lookup_options (
  id                    SERIAL PRIMARY KEY,
  list_key              VARCHAR(50) NOT NULL,
  code                  VARCHAR(30) NOT NULL,
  label                 TEXT NOT NULL,
  description           TEXT DEFAULT '',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_key, code),
  UNIQUE (list_key, label)
);
CREATE INDEX idx_lookup_options_list ON lookup_options(list_key, is_active, sort_order, label);

CREATE TABLE projects (
  id                    SERIAL PRIMARY KEY,
  code                  VARCHAR(20) NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  sector_id             INTEGER REFERENCES sectors(id) ON DELETE RESTRICT,
  description           TEXT DEFAULT '',
  funding_source        VARCHAR(80) DEFAULT '',
  start_date            DATE,
  end_date              DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
  created_by            INTEGER NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Authorizes an Officer to work under a project (SDD 2.2/7.3).
CREATE TABLE project_assignments (
  id                    SERIAL PRIMARY KEY,
  project_id            INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  officer_id            INTEGER NOT NULL REFERENCES users(id),
  assigned_by           INTEGER NOT NULL REFERENCES users(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, officer_id)
);
CREATE INDEX idx_project_assignments_officer ON project_assignments(officer_id);
CREATE INDEX idx_projects_sector ON projects(sector_id);

-- Category-specific plan under one project (SDD 2.3 lifecycle).
CREATE TABLE procurement_plans (
  id                    SERIAL PRIMARY KEY,
  reference             VARCHAR(40) NOT NULL UNIQUE,
  project_id            INTEGER NOT NULL REFERENCES projects(id),
  category              VARCHAR(30) NOT NULL CHECK (category IN ('Goods', 'Works', 'Non-Consulting Services', 'Consultancy Services')),
  name                  TEXT NOT NULL,
  fiscal_year           INTEGER NOT NULL,
  period_start          DATE,
  period_end            DATE,
  default_currency      VARCHAR(10) NOT NULL DEFAULT 'USD' CHECK (default_currency IN ('USD', 'ETB')),
  description           TEXT DEFAULT '',
  status                VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                          'DRAFT', 'SUBMITTED_TO_DIRECTOR', 'RETURNED_FOR_CORRECTION', 'REJECTED_BY_DIRECTOR',
                          'DIRECTOR_APPROVED', 'COMMITTEE_REVIEW', 'MANAGEMENT_REVIEW', 'FINALLY_APPROVED',
                          'REJECTED_BY_COMMITTEE', 'REJECTED_BY_MANAGEMENT',
                          'REPLANNED', 'CLOSED', 'CANCELLED'
                        )),
  created_by            INTEGER NOT NULL REFERENCES users(id),
  submitted_at          TIMESTAMPTZ,
  director_id           INTEGER REFERENCES users(id),
  director_decision     VARCHAR(20) CHECK (director_decision IN ('APPROVE', 'RETURN', 'REJECT')),
  director_comment      TEXT,
  director_decided_at   TIMESTAMPTZ,
  finally_approved_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_project ON procurement_plans(project_id);
CREATE INDEX idx_plans_status ON procurement_plans(status);
CREATE INDEX idx_plans_created_by ON procurement_plans(created_by);

-- Main Excel-equivalent procurement record under a plan (SDD 2.1/7.5).
-- Common fields are relational; category-specific extras live in category_data.
CREATE TABLE procurement_activities (
  id                    SERIAL PRIMARY KEY,
  reference             VARCHAR(50) NOT NULL UNIQUE,
  plan_id               INTEGER NOT NULL REFERENCES procurement_plans(id) ON DELETE CASCADE,
  description           TEXT NOT NULL,
  method                VARCHAR(20) NOT NULL,
  amount                NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency              VARCHAR(10) NOT NULL DEFAULT 'ETB',
  category_data         JSONB NOT NULL DEFAULT '{}',
  status                VARCHAR(20) NOT NULL DEFAULT 'Planned',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_plan ON procurement_activities(plan_id);

-- One generated milestone for a Procurement Activity (SDD 7.3/8.1).
CREATE TABLE activity_stages (
  id                    SERIAL PRIMARY KEY,
  activity_id           INTEGER NOT NULL REFERENCES procurement_activities(id) ON DELETE CASCADE,
  sequence_no           INTEGER NOT NULL,
  name                  VARCHAR(80) NOT NULL,
  original_date         DATE,
  revised_date          DATE,
  actual_date           DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'InProgress', 'Completed', 'NotApplicable')),
  remarks               TEXT DEFAULT '',
  UNIQUE (activity_id, sequence_no)
);
CREATE INDEX idx_stages_activity ON activity_stages(activity_id);

-- Preserves a replan: original date stays on the stage, this records the change (SDD 8, Replanning).
CREATE TABLE activity_revisions (
  id                    SERIAL PRIMARY KEY,
  stage_id              INTEGER NOT NULL REFERENCES activity_stages(id) ON DELETE CASCADE,
  old_date              DATE,
  new_date              DATE NOT NULL,
  reason                TEXT NOT NULL,
  changed_by            INTEGER NOT NULL REFERENCES users(id),
  changed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_revisions_stage ON activity_revisions(stage_id);

-- One Ministry-wide committee, exactly five active members expected (SDD default, 20.2).
CREATE TABLE committee_members (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE management_members (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  leadership_id         INTEGER UNIQUE REFERENCES leadership_registry(id) ON DELETE RESTRICT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One Approve/Reject decision per member per plan (SDD 7.3/8).
CREATE TABLE committee_votes (
  id                    SERIAL PRIMARY KEY,
  plan_id               INTEGER NOT NULL REFERENCES procurement_plans(id) ON DELETE CASCADE,
  member_id             INTEGER NOT NULL REFERENCES users(id),
  decision              VARCHAR(10) NOT NULL CHECK (decision IN ('Approve', 'Reject')),
  comment               TEXT DEFAULT '',
  voted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, member_id)
);
CREATE INDEX idx_votes_plan ON committee_votes(plan_id);

CREATE TABLE management_decisions (
  id                    SERIAL PRIMARY KEY,
  plan_id               INTEGER NOT NULL UNIQUE REFERENCES procurement_plans(id) ON DELETE CASCADE,
  decided_by            INTEGER NOT NULL REFERENCES users(id),
  decision              VARCHAR(10) NOT NULL CHECK (decision IN ('Approve', 'Reject')),
  comment               TEXT DEFAULT '',
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision <> 'Reject' OR length(trim(comment)) > 0)
);

CREATE TABLE suppliers (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  contact               TEXT DEFAULT '',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One main contract per activity (SDD 7.3/7.4).
CREATE TABLE contracts (
  id                    SERIAL PRIMARY KEY,
  activity_id           INTEGER NOT NULL UNIQUE REFERENCES procurement_activities(id),
  contract_number       VARCHAR(40) NOT NULL UNIQUE,
  supplier_id           INTEGER NOT NULL REFERENCES suppliers(id),
  original_amount       NUMERIC(18, 2) NOT NULL CHECK (original_amount >= 0),
  current_amount        NUMERIC(18, 2) NOT NULL CHECK (current_amount >= 0),
  final_amount          NUMERIC(18, 2) CHECK (final_amount >= 0),
  currency              VARCHAR(10) NOT NULL DEFAULT 'ETB' CHECK (currency IN ('USD', 'ETB')),
  contract_date         DATE NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Terminated')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id                    SERIAL PRIMARY KEY,
  contract_id           INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amount                NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  payment_type          VARCHAR(30) NOT NULL DEFAULT 'Interim',
  payment_date          DATE NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Pending')),
  remarks               TEXT DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_contract ON payments(contract_id);

CREATE TABLE alerts (
  id                    SERIAL PRIMARY KEY,
  recipient_id          INTEGER NOT NULL REFERENCES users(id),
  type                  VARCHAR(40) NOT NULL,
  message               TEXT NOT NULL,
  related_type          VARCHAR(30),
  related_id            INTEGER,
  status                VARCHAR(10) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_recipient ON alerts(recipient_id, status);

-- Keeps updated_at current on plan/activity edits.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON procurement_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON procurement_activities
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
