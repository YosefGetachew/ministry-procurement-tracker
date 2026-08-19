-- Adds the project level beneath sector without deleting or recreating records.
BEGIN;

ALTER TABLE procurements ADD COLUMN IF NOT EXISTS project VARCHAR(120);

UPDATE procurements
SET project = CASE
  WHEN id = 'PA-2026-014' THEN 'Seed System Development'
  WHEN id = 'PA-2026-021' THEN 'Fertilizer Supply Program'
  WHEN id = 'PA-2026-009' THEN 'Small-Scale Irrigation Development'
  WHEN id = 'PA-2026-033' THEN 'Animal Health Improvement'
  WHEN id = 'PA-2026-005' THEN 'Farm Mechanization Program'
  WHEN id = 'PA-2026-041' THEN 'Field Officer Mobility'
  WHEN id = 'PA-2026-018' THEN 'Cold Chain Development'
  WHEN id = 'PA-2026-027' THEN 'Post-Harvest Machinery Support'
  WHEN id = 'PA-2026-038' THEN 'Locust Response Program'
  WHEN id = 'PA-2026-012' THEN 'Apiculture Value Chain'
  WHEN sector = 'Crop Production' THEN 'Crop Productivity Enhancement'
  WHEN sector = 'Agricultural Inputs' THEN 'Agricultural Input Distribution'
  WHEN sector = 'Irrigation & Water' THEN 'Irrigation Equipment Support'
  WHEN sector = 'Livestock & Animal Health' THEN 'Livestock Productivity'
  WHEN sector = 'Agricultural Mechanization' THEN 'Agricultural Equipment Modernization'
  WHEN sector = 'Extension Services' THEN 'Agricultural Extension Support'
  WHEN sector = 'Post-Harvest Management' THEN 'Storage & Processing Infrastructure'
  WHEN sector = 'Plant Protection' THEN 'Pest Surveillance & Control'
  ELSE 'General Sector Operations'
END
WHERE project IS NULL OR project = '' OR project = 'General Sector Operations';

ALTER TABLE procurements ALTER COLUMN project SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_procurements_project ON procurements(project);

COMMIT;
