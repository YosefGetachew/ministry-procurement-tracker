-- Adds Ministry Management Committee as the final approval level.
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('officer', 'director', 'committee', 'management', 'admin'));

ALTER TABLE procurement_plans DROP CONSTRAINT IF EXISTS procurement_plans_status_check;
ALTER TABLE procurement_plans ADD CONSTRAINT procurement_plans_status_check CHECK (status IN (
  'DRAFT', 'SUBMITTED_TO_DIRECTOR', 'RETURNED_FOR_CORRECTION', 'REJECTED_BY_DIRECTOR',
  'DIRECTOR_APPROVED', 'COMMITTEE_REVIEW', 'MANAGEMENT_REVIEW', 'FINALLY_APPROVED',
  'REJECTED_BY_COMMITTEE', 'REJECTED_BY_MANAGEMENT', 'REPLANNED', 'CLOSED', 'CANCELLED'
));

CREATE TABLE IF NOT EXISTS management_decisions (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL UNIQUE REFERENCES procurement_plans(id) ON DELETE CASCADE,
  decided_by INTEGER NOT NULL REFERENCES users(id),
  decision VARCHAR(10) NOT NULL CHECK (decision IN ('Approve', 'Reject')),
  comment TEXT DEFAULT '',
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision <> 'Reject' OR length(trim(comment)) > 0)
);

INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
VALUES ('Ministry Management Secretary', 'management@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'management', true, false)
ON CONFLICT (email) DO UPDATE SET role = 'management', is_active = true, must_change_password = false;

COMMIT;
