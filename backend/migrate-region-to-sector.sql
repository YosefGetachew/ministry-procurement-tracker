-- One-time, non-destructive upgrade for databases created with geographic ownership.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'procurements' AND column_name = 'region'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'procurements' AND column_name = 'sector'
  ) THEN
    ALTER TABLE procurements RENAME COLUMN region TO sector;
  END IF;
END $$;

UPDATE procurements
SET sector = CASE
  WHEN department ILIKE '%crop%' THEN 'Crop Production'
  WHEN department ILIKE '%input%' OR category = 'Fertilizer' THEN 'Agricultural Inputs'
  WHEN department ILIKE '%irrigation%' OR category = 'Irrigation' THEN 'Irrigation & Water'
  WHEN department ILIKE '%animal health%' OR department ILIKE '%livestock%' OR department ILIKE '%apiculture%' THEN 'Livestock & Animal Health'
  WHEN department ILIKE '%mechanization%' OR department ILIKE '%seed systems%' THEN 'Agricultural Mechanization'
  WHEN department ILIKE '%extension%' THEN 'Extension Services'
  WHEN department ILIKE '%post-harvest%' THEN 'Post-Harvest Management'
  WHEN department ILIKE '%plant protection%' THEN 'Plant Protection'
  WHEN category = 'Seeds & Inputs' THEN 'Crop Production'
  WHEN category = 'Services' THEN 'Extension Services'
  WHEN category = 'Infrastructure' THEN 'Post-Harvest Management'
  ELSE 'Agricultural Mechanization'
END
WHERE sector IN ('Oromia', 'Amhara', 'SNNPR', 'Tigray', 'Somali', 'Addis Ababa');

DROP INDEX IF EXISTS idx_procurements_region;
CREATE INDEX IF NOT EXISTS idx_procurements_sector ON procurements(sector);

COMMIT;
