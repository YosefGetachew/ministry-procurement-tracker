require('dotenv').config();
const { Pool } = require('pg');

// Uses DATABASE_URL if present, otherwise falls back to PG* env vars,
// which node-postgres reads automatically.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : undefined
);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on idle client', err);
});

module.exports = pool;
