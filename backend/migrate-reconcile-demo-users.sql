-- Restore the intended roles and login state for the nine development accounts.
BEGIN;

UPDATE users SET name = 'System Administrator', role = 'admin' WHERE lower(email) = 'admin@moa.gov.et';
UPDATE users SET name = 'Tsegaye Alemu', role = 'director' WHERE lower(email) = 'director@moa.gov.et';
UPDATE users SET name = 'Abebe Kassa', role = 'officer' WHERE lower(email) = 'abebe.kassa@moa.gov.et';
UPDATE users SET name = 'Selamawit Tesfaye', role = 'officer' WHERE lower(email) = 'selamawit.tesfaye@moa.gov.et';
UPDATE users SET name = 'Meron Girma', role = 'committee' WHERE lower(email) = 'meron.girma@moa.gov.et';
UPDATE users SET name = 'Dawit Alemayehu', role = 'committee' WHERE lower(email) = 'dawit.alemayehu@moa.gov.et';
UPDATE users SET name = 'Hana Yohannes', role = 'committee' WHERE lower(email) = 'hana.yohannes@moa.gov.et';
UPDATE users SET name = 'Bereket Solomon', role = 'committee' WHERE lower(email) = 'bereket.solomon@moa.gov.et';
UPDATE users SET name = 'Rahel Getachew', role = 'committee' WHERE lower(email) = 'rahel.getachew@moa.gov.et';

UPDATE users
SET password_hash = crypt('changeme123', gen_salt('bf')),
    must_change_password = false,
    is_active = true
WHERE lower(email) IN (
  'admin@moa.gov.et', 'director@moa.gov.et',
  'abebe.kassa@moa.gov.et', 'selamawit.tesfaye@moa.gov.et',
  'meron.girma@moa.gov.et', 'dawit.alemayehu@moa.gov.et',
  'hana.yohannes@moa.gov.et', 'bereket.solomon@moa.gov.et',
  'rahel.getachew@moa.gov.et'
);

ALTER TABLE users ALTER COLUMN must_change_password SET DEFAULT false;

INSERT INTO committee_members (user_id, is_active)
SELECT id, true FROM users WHERE role = 'committee'
ON CONFLICT (user_id) DO UPDATE SET is_active = true;

UPDATE committee_members cm
SET is_active = false
FROM users u
WHERE cm.user_id = u.id AND u.role <> 'committee';

COMMIT;
