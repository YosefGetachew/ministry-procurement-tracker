-- Ministry leadership seats used to compose the Management Committee.
CREATE TABLE IF NOT EXISTS leadership_registry (
  id SERIAL PRIMARY KEY,
  position VARCHAR(30) NOT NULL CHECK (position IN ('state_minister', 'minister', 'ceo', 'minister_office_head')),
  sector_id INTEGER REFERENCES sectors(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  biography TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((position = 'state_minister' AND sector_id IS NOT NULL) OR (position <> 'state_minister' AND sector_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadership_active_seat
  ON leadership_registry(position, COALESCE(sector_id, 0)) WHERE is_active;

ALTER TABLE management_members ADD COLUMN IF NOT EXISTS leadership_id INTEGER REFERENCES leadership_registry(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_management_members_leadership
  ON management_members(leadership_id) WHERE leadership_id IS NOT NULL;

-- Legacy test management accounts are not one of the seven statutory seats.
UPDATE management_members SET is_active = false WHERE leadership_id IS NULL;
