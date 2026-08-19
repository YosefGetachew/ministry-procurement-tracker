-- Adds requester-owned procurement plans and links existing procurements without data loss.
BEGIN;

CREATE TABLE IF NOT EXISTS procurement_plans (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(24) NOT NULL UNIQUE,
  requester TEXT NOT NULL,
  title TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  sector VARCHAR(80) NOT NULL,
  project VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  department TEXT NOT NULL,
  planned_value NUMERIC(16, 2) NOT NULL CHECK (planned_value > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Approved' CHECK (status IN ('Draft', 'Approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE procurements ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES procurement_plans(id);

INSERT INTO procurement_plans
  (reference, requester, title, fiscal_year, sector, project, category, department, planned_value, status, created_at)
SELECT
  'PL-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY p.id)::text, 3, '0'),
  'Procurement Admin',
  p.title,
  2026,
  p.sector,
  p.project,
  p.category,
  p.department,
  ROUND(p.est_value * 1.25, 2),
  'Approved',
  p.created_at - INTERVAL '30 days'
FROM procurements p
WHERE p.plan_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM procurement_plans pp WHERE pp.title = p.title)
ON CONFLICT (reference) DO NOTHING;

UPDATE procurements p
SET plan_id = pp.id
FROM procurement_plans pp
WHERE p.plan_id IS NULL AND pp.title = p.title AND pp.requester = 'Procurement Admin';

CREATE INDEX IF NOT EXISTS idx_procurements_plan_id ON procurements(plan_id);
CREATE INDEX IF NOT EXISTS idx_procurement_plans_requester ON procurement_plans(requester);

COMMIT;
