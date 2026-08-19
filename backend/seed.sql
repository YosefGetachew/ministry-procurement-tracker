-- Demo data for the Ministry of Agriculture procurement tracker (SDD v1.2 model).
-- Run after schema.sql, e.g.:
--   psql -U postgres -d moa_procurement -f seed.sql

TRUNCATE alerts, payments, contracts, suppliers, committee_votes, committee_members, management_members,
  activity_revisions, activity_stages, procurement_activities, procurement_plans, management_decisions,
  project_assignments, projects, lookup_options, sectors, users
  RESTART IDENTITY CASCADE;

-- Password for every demo account is "changeme123" — change before any real use.
INSERT INTO users (name, email, password_hash, role) VALUES
('System Administrator', 'admin@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'admin'),
('Tsegaye Alemu', 'director@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'director'),
('Abebe Kassa', 'abebe.kassa@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'officer'),
('Selamawit Tesfaye', 'selamawit.tesfaye@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'officer'),
('Meron Girma', 'meron.girma@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'committee'),
('Dawit Alemayehu', 'dawit.alemayehu@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'committee'),
('Hana Yohannes', 'hana.yohannes@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'committee'),
('Bereket Solomon', 'bereket.solomon@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'committee'),
('Rahel Getachew', 'rahel.getachew@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'committee');

INSERT INTO users (name, email, password_hash, role, is_active, must_change_password) VALUES
('Ministry Management Secretary', 'management@moa.gov.et', crypt('changeme123', gen_salt('bf')), 'management', true, false);

INSERT INTO committee_members (user_id, is_active)
  SELECT id, true FROM users WHERE role = 'committee';

INSERT INTO management_members (user_id, is_active)
  SELECT id, true FROM users WHERE role = 'management';

-- One demo project, created by the Director and assigned to one of the two Officers
-- (the second Officer is left unassigned to exercise the "denied" authorization path).
INSERT INTO sectors (code, name, description) VALUES
('NRM', 'Natural Resources Management', 'Natural resources, irrigation and climate-resilience programs.');

INSERT INTO lookup_options (list_key, code, label, sort_order) VALUES
('funding_source', 'GOV', 'Government Treasury', 10),
('funding_source', 'DP', 'Development Partner', 20),
('funding_source', 'LOAN', 'Loan', 30),
('funding_source', 'GRANT', 'Grant', 40),
('funding_source', 'MIXED', 'Mixed Funding', 50);

INSERT INTO projects (code, name, sector_id, description, funding_source, start_date, end_date, status, created_by)
  SELECT 'IRR', 'Irrigation Infrastructure Modernization', s.id, 'Small-scale irrigation and water-harvesting infrastructure program.', 'Government Treasury', '2026-01-01', '2027-12-31', 'Active', u.id
  FROM users u CROSS JOIN sectors s WHERE u.email = 'director@moa.gov.et' AND s.code = 'NRM';

INSERT INTO project_assignments (project_id, officer_id, assigned_by, is_active)
  SELECT p.id, o.id, d.id, true
  FROM projects p, users o, users d
  WHERE p.code = 'IRR' AND o.email = 'abebe.kassa@moa.gov.et' AND d.email = 'director@moa.gov.et';
