require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  const name = String(process.env.ADMIN_NAME || '').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!name || !email || password.length < 12) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 12 characters)');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, 'admin', true, true)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = 'admin',
           is_active = true,
           must_change_password = true
     RETURNING id, name, email, role`,
    [name, email, passwordHash]
  );
  console.log(`Administrator ready: ${rows[0].email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
