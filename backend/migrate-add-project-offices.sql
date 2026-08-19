ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS structure_type VARCHAR(30) NOT NULL DEFAULT 'sector';

ALTER TABLE sectors DROP CONSTRAINT IF EXISTS sectors_structure_type_check;
ALTER TABLE sectors ADD CONSTRAINT sectors_structure_type_check
  CHECK (structure_type IN ('sector', 'ceo_office', 'minister_office_head'));

INSERT INTO sectors (code, name, description, structure_type, is_active)
VALUES
  ('CEO_OFFICE', 'CEO Office', 'Projects reporting through the Chief Executive Officer.', 'ceo_office', true),
  ('MINISTER_OFFICE_HEAD', 'Minister Office Head', 'Projects reporting through the Head of the Minister''s Office.', 'minister_office_head', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  structure_type = EXCLUDED.structure_type,
  is_active = true;
