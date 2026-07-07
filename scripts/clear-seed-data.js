require('dotenv').config();

const { pool } = require('../server/db');

const seedQueries = {
  notifications: "SELECT count(*)::int AS count FROM notifications WHERE metadata->>'seed' = 'true'",
  payments: "SELECT count(*)::int AS count FROM payments WHERE metadata->>'seed' = 'true'",
  prescriptions: "SELECT count(*)::int AS count FROM prescriptions WHERE metadata->>'seed' = 'true'",
  medical_documents: "SELECT count(*)::int AS count FROM medical_documents WHERE metadata->>'seed' = 'true'",
  appointments: "SELECT count(*)::int AS count FROM appointments WHERE metadata->>'seed' = 'true'",
  otp_challenges: "SELECT count(*)::int AS count FROM otp_challenges WHERE metadata->>'seed' = 'true'",
  users: "SELECT count(*)::int AS count FROM users WHERE metadata->>'seed' = 'true'",
};

async function seedCounts(client) {
  const counts = {};
  for (const [table, sql] of Object.entries(seedQueries)) {
    const result = await client.query(sql);
    counts[table] = result.rows[0].count;
  }
  return counts;
}

async function main() {
  const client = await pool.connect();
  try {
    const before = await seedCounts(client);
    await client.query('BEGIN');
    await client.query("DELETE FROM notifications WHERE metadata->>'seed' = 'true'");
    await client.query("DELETE FROM payments WHERE metadata->>'seed' = 'true'");
    await client.query("DELETE FROM prescriptions WHERE metadata->>'seed' = 'true'");
    await client.query("DELETE FROM medical_documents WHERE metadata->>'seed' = 'true'");
    await client.query("DELETE FROM appointments WHERE metadata->>'seed' = 'true'");
    await client.query("DELETE FROM otp_challenges WHERE metadata->>'seed' = 'true'");
    await client.query("DELETE FROM users WHERE metadata->>'seed' = 'true'");
    await client.query('COMMIT');
    const after = await seedCounts(client);
    console.log(JSON.stringify({ before, after }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('Seed cleanup failed.');
    console.error(error.message || error.code || error.name);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
