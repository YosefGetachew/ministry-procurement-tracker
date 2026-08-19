-- Non-destructive additions for existing SDD v1.2 databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_projects_sector ON projects(sector_id);
INSERT INTO sectors (code, name, description) VALUES ('GENERAL', 'General Agriculture', 'Default sector for projects created before sector classification.') ON CONFLICT (code) DO NOTHING;
UPDATE projects SET sector_id = (SELECT id FROM sectors WHERE code = 'GENERAL') WHERE sector_id IS NULL;

ALTER TABLE procurement_plans ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE procurement_plans ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE procurement_plans ADD COLUMN IF NOT EXISTS default_currency VARCHAR(10) NOT NULL DEFAULT 'USD';

ALTER TABLE procurement_plans DROP CONSTRAINT IF EXISTS procurement_plans_default_currency_check;
ALTER TABLE procurement_plans ADD CONSTRAINT procurement_plans_default_currency_check CHECK (default_currency IN ('USD', 'ETB'));

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS final_amount NUMERIC(18, 2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'ETB';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(30) NOT NULL DEFAULT 'Interim';
