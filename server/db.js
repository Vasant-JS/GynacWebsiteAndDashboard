const { Pool } = require('pg');

function sslConfig() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'require' || mode === 'no-verify') {
    return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' && mode !== 'no-verify' };
  }
  if (process.env.DATABASE_URL && /supabase\.com|pooler\.supabase\.com/.test(process.env.DATABASE_URL)) {
    return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  return undefined;
}

function databaseConfig() {
  const ssl = sslConfig();
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...(ssl !== undefined ? { ssl } : {}),
    };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'femmecare',
    ...(ssl !== undefined ? { ssl } : {}),
  };
}

const pool = new Pool(
  databaseConfig(),
);

module.exports = { pool };
