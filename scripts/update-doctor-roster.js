require('dotenv').config({ quiet: true });
const { pool } = require('../server/db');
const { syncDoctorRoster } = require('../server/doctor-roster');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await syncDoctorRoster(client);
    await client.query('COMMIT');
    console.log('Doctor roster updated. Previous doctors retired; appointment history preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
})().catch((error) => {
  console.error('Doctor roster update failed:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
