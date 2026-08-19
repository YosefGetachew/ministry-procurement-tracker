-- Reusable administrator-managed dropdown values.
CREATE TABLE IF NOT EXISTS lookup_options (
  id SERIAL PRIMARY KEY,
  list_key VARCHAR(50) NOT NULL,
  code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_key, code),
  UNIQUE (list_key, label)
);

CREATE INDEX IF NOT EXISTS idx_lookup_options_list
  ON lookup_options(list_key, is_active, sort_order, label);

INSERT INTO lookup_options (list_key, code, label, sort_order) VALUES
  ('funding_source', 'GOV', 'Government Treasury', 10),
  ('funding_source', 'DP', 'Development Partner', 20),
  ('funding_source', 'LOAN', 'Loan', 30),
  ('funding_source', 'GRANT', 'Grant', 40),
  ('funding_source', 'MIXED', 'Mixed Funding', 50)
ON CONFLICT (list_key, code) DO NOTHING;
