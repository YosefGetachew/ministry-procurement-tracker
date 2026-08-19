-- Ensure the seeded system administrator retains administrator navigation and permissions.
UPDATE users
SET role = 'admin'
WHERE lower(email) = 'admin@moa.gov.et';
