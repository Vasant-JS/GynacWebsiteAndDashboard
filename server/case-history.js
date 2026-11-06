const express = require('express');
const { pool } = require('./db');
const Clinical = require('../assets/js/clinical-schema');
const router = express.Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureCaseHistorySchema(client = pool) {
  await client.query(`CREATE TABLE IF NOT EXISTS case_sheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id uuid NOT NULL REFERENCES users(id),
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    calculations jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
  await client.query('CREATE INDEX IF NOT EXISTS case_sheets_patient_idx ON case_sheets(patient_id, updated_at DESC)');
  await client.query(`CREATE TABLE IF NOT EXISTS case_sheet_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_sheet_id uuid NOT NULL REFERENCES case_sheets(id) ON DELETE CASCADE,
    doctor_id uuid NOT NULL REFERENCES users(id), version integer NOT NULL,
    data jsonb NOT NULL, calculations jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_sheet_id, version))`);
}

router.get('/appointments/:id/case-history', async (req, res, next) => {
  if (!uuid.test(req.params.id)) return res.status(400).json({ message: 'Invalid appointment ID.' });
  try {
    const appointment = await pool.query("SELECT a.*, p.display_name AS patient_name, p.profile FROM appointments a JOIN users p ON p.id = a.patient_id JOIN users d ON d.id = a.doctor_id AND d.status = 'ACTIVE' WHERE a.id = $1 AND a.doctor_id = $2", [req.params.id, req.authUser.id]);
    if (!appointment.rowCount) return res.status(404).json({ message: 'Appointment not found.' });
    const visit = appointment.rows[0];
    const [sheet, history] = await Promise.all([
      pool.query('SELECT * FROM case_sheets WHERE appointment_id = $1', [visit.id]),
      pool.query(`SELECT a.id, a.appointment_at, a.service_type, a.status, a.notes, d.display_name AS doctor_name,
        c.id AS case_sheet_id, c.data, c.calculations, c.version, c.updated_at
        FROM appointments a JOIN users d ON d.id = a.doctor_id LEFT JOIN case_sheets c ON c.appointment_id = a.id
        WHERE a.patient_id = $1 AND a.status <> 'CANCELLED' ORDER BY a.appointment_at DESC`, [visit.patient_id]),
    ]);
    const revisions = sheet.rowCount ? await pool.query('SELECT r.version, r.created_at, r.data, r.calculations, d.display_name AS doctor_name FROM case_sheet_revisions r JOIN users d ON d.id = r.doctor_id WHERE r.case_sheet_id = $1 ORDER BY r.version DESC', [sheet.rows[0].id]) : { rows: [] };
    res.json({ appointment: visit, caseId: 'SC-' + visit.patient_id, sheet: sheet.rows[0] || null, history: history.rows, revisions: revisions.rows });
  } catch (error) { next(error); }
});

router.put('/appointments/:id/case-history', async (req, res, next) => {
  if (!uuid.test(req.params.id)) return res.status(400).json({ message: 'Invalid appointment ID.' });
  let data;
  try { data = Clinical.normalize(req.body.data); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  if (!Number.isInteger(req.body.version) || req.body.version < 0) return res.status(400).json({ message: 'A valid case-sheet version is required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appointment = await client.query("SELECT * FROM appointments WHERE id = $1 AND doctor_id = $2 AND EXISTS (SELECT 1 FROM users WHERE id = $2 AND role = 'DOCTOR' AND status = 'ACTIVE') FOR UPDATE", [req.params.id, req.authUser.id]);
    if (!appointment.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Appointment not found.' }); }
    if (appointment.rows[0].status === 'CANCELLED') { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Cancelled appointments cannot be edited.' }); }
    const current = await client.query('SELECT * FROM case_sheets WHERE appointment_id = $1', [req.params.id]);
    if ((current.rows[0]?.version || 0) !== req.body.version) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Another session updated this case sheet. Reload the latest version before saving.' }); }
    const calculations = Clinical.calculations(data);
    const visit = appointment.rows[0];
    const saved = await client.query(`INSERT INTO case_sheets (appointment_id, patient_id, doctor_id, data, calculations)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      ON CONFLICT (appointment_id) DO UPDATE SET data = EXCLUDED.data, calculations = EXCLUDED.calculations, version = case_sheets.version + 1, updated_at = now()
      RETURNING *`, [visit.id, visit.patient_id, req.authUser.id, JSON.stringify(data), JSON.stringify(calculations)]);
    const sheet = saved.rows[0];
    await client.query('INSERT INTO case_sheet_revisions (case_sheet_id, doctor_id, version, data, calculations) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)', [sheet.id, req.authUser.id, sheet.version, JSON.stringify(data), JSON.stringify(calculations)]);
    await client.query('COMMIT');
    res.json({ sheet, message: 'Case sheet saved.' });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});
module.exports = { caseHistoryRouter: router, ensureCaseHistorySchema };
