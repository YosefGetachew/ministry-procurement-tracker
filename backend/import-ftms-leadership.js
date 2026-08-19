const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const ftmsEnv = dotenv.parse(fs.readFileSync('D:/OneDrive/projects/FTMS/backend/.env'));
const ptsEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env')));
const source = new Pool({
  user: ftmsEnv.DB_USER,
  host: ftmsEnv.DB_HOST,
  database: ftmsEnv.DB_NAME,
  password: ftmsEnv.DB_PASSWORD,
  port: Number(ftmsEnv.DB_PORT || 5432),
});
const target = new Pool({ connectionString: ptsEnv.DATABASE_URL });

const roles = {
  state_minister: 'state_minister',
  minister: 'minister',
  chief_executive_officer: 'ceo',
  ceo: 'ceo',
  office_head: 'minister_office_head',
};
const sectorCodes = {
  'Livestock and Fisheries Resource Development': 'LIVESTOCK_FISH',
  'Natural Resource Development': 'NATURAL_RESOURCE',
  'Agricultural Investment and Input Supply': 'AGRI_INPUT',
  'Agriculture and Horticulture Development': 'AGRI_HORT',
};

async function main() {
  const { rows: leaders } = await source.query(`
    SELECT full_name, LOWER(TRIM(email)) AS email, COALESCE(phone, '') AS phone,
           TRIM(COALESCE(sector, '')) AS sector, LOWER(TRIM(role)) AS role
    FROM users
    WHERE LOWER(role) IN ('state_minister', 'minister', 'chief_executive_officer', 'ceo', 'office_head')
      AND is_active = true AND account_status = 'active'
    ORDER BY id
  `);
  if (leaders.length !== 7) throw new Error(`Expected 7 active FTMS leaders; found ${leaders.length}`);

  const client = await target.connect();
  try {
    await client.query('BEGIN');
    const sectorIds = {};
    for (const [name, code] of Object.entries(sectorCodes)) {
      const { rows } = await client.query(`
        INSERT INTO sectors (code, name, description, is_active)
        VALUES ($1, $2, 'Imported from FTMS ministry structure.', true)
        ON CONFLICT (name) DO UPDATE SET is_active = true
        RETURNING id
      `, [code, name]);
      sectorIds[name] = rows[0].id;
    }

    for (const leader of leaders) {
      const position = roles[leader.role];
      const sectorId = position === 'state_minister' ? sectorIds[leader.sector] : null;
      if (position === 'state_minister' && !sectorId) throw new Error(`No PTS sector mapping for ${leader.sector}`);
      await client.query(`
        INSERT INTO leadership_registry
          (position, sector_id, name, email, phone, biography, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, false)
        ON CONFLICT (email) DO UPDATE SET
          position = EXCLUDED.position,
          sector_id = EXCLUDED.sector_id,
          name = EXCLUDED.name,
          biography = CASE WHEN leadership_registry.biography = '' THEN EXCLUDED.biography ELSE leadership_registry.biography END,
          updated_at = now()
      `, [position, sectorId, leader.full_name.trim(), leader.email, leader.phone.trim(), 'Imported from FTMS. Complete the phone number before activation.']);
    }
    await client.query(`UPDATE leadership_registry SET is_active = false, updated_at = now() WHERE TRIM(phone) = ''`);
    await client.query('COMMIT');
    const { rows: audit } = await client.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE is_active)::int AS active,
             COUNT(*) FILTER (WHERE TRIM(phone) = '')::int AS missing_phone
      FROM leadership_registry
      WHERE biography LIKE 'Imported from FTMS.%'
    `);
    console.log(`Imported ${leaders.length} FTMS leadership records and ${Object.keys(sectorIds).length} sector mappings.`, audit[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await source.end();
  await target.end();
});
