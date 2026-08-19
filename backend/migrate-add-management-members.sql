-- Formal registry for Ministry Management Committee membership.
CREATE TABLE IF NOT EXISTS management_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO management_members (user_id, is_active)
SELECT id, true FROM users WHERE role = 'management'
ON CONFLICT (user_id) DO UPDATE SET is_active = true;
