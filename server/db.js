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
  const baseConfig = {
    connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 5000),
    idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS || 30000),
  };
  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      connectionString: process.env.DATABASE_URL,
      ...(ssl !== undefined ? { ssl } : {}),
    };
  }
  return {
    ...baseConfig,
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

function isDbUnavailable(error) {
  if (!error) return false;
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EACCES', 'ECONNRESET', 'EHOSTUNREACH'].includes(error.code)) return true;
  return /connection (terminated|timeout|refused)|timed out|network is unreachable|no route to host/i.test(String(error.message || ''));
}

module.exports = { pool, isDbUnavailable };
