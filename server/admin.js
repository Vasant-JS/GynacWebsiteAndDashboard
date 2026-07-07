const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const router = express.Router();

function isDbUnavailable(error) {
  return error && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code);
}

async function currentAdmin(req) {
  const email = req.session.user?.role === 'ADMIN' ? req.session.user.email : 'admin@aura.test';
  const result = await pool.query('SELECT id, display_name, email, profile FROM users WHERE role = $1 AND email = $2 LIMIT 1', ['ADMIN', email]);
  return result.rows[0] || null;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const admin = await currentAdmin(req);
    if (!admin) return res.status(404).json({ message: 'Admin record not found in database.' });
    const counts = await pool.query(
      `
        SELECT
          count(*) FILTER (WHERE role = 'DOCTOR' AND status = 'ACTIVE') AS active_doctors,
          count(*) FILTER (WHERE role = 'PATIENT') AS total_patients,
          count(*) FILTER (WHERE role = 'PATIENT' AND created_at >= now() - interval '7 days') AS new_patients
        FROM users
      `,
    );
    const appointments = await pool.query(
      `
        SELECT count(*) FILTER (WHERE appointment_at::date = current_date) AS today_appointments,
               count(*) FILTER (WHERE status = 'SCHEDULED') AS scheduled,
               count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
               count(*) FILTER (WHERE status = 'CANCELLED') AS cancelled
        FROM appointments
      `,
    );
    const payments = await pool.query(
      `
        SELECT COALESCE(sum(amount) FILTER (WHERE created_at::date = current_date AND status = 'PAID'), 0) AS today_revenue,
               COALESCE(sum(amount) FILTER (WHERE status = 'PENDING'), 0) AS pending_amount,
               COALESCE(sum(amount) FILTER (WHERE status = 'REFUNDED'), 0) AS refunded_amount
        FROM payments
      `,
    );
    const activity = await pool.query(
      `
        SELECT 'Appointment' AS action, service_type AS entity, status, updated_at AS timestamp FROM appointments
        UNION ALL
        SELECT 'Payment' AS action, currency || ' ' || amount::text AS entity, status, created_at AS timestamp FROM payments
        ORDER BY timestamp DESC LIMIT 8
      `,
    );
    const trend = await pool.query(
      `
        SELECT to_char(day, 'Dy') AS label,
               count(a.id) FILTER (WHERE a.status <> 'CANCELLED') AS confirmed,
               count(a.id) FILTER (WHERE a.status = 'SCHEDULED') AS pending
        FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') AS day
        LEFT JOIN appointments a ON a.appointment_at::date = day::date
        GROUP BY day ORDER BY day
      `,
    );
    res.json({
      admin: { id: admin.id, displayName: admin.display_name, email: admin.email, profile: admin.profile || {} },
      stats: {
        ...counts.rows[0],
        ...appointments.rows[0],
        todayRevenue: Number(payments.rows[0].today_revenue || 0),
        pendingAmount: Number(payments.rows[0].pending_amount || 0),
        refundedAmount: Number(payments.rows[0].refunded_amount || 0),
      },
      activity: activity.rows,
      trend: trend.rows.map((item) => ({ label: item.label, confirmed: Number(item.confirmed || 0), pending: Number(item.pending || 0) })),
      storage: 'postgres',
    });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/doctors', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT u.id, u.display_name, u.email, u.phone, u.status, u.profile,
               count(a.id) FILTER (WHERE a.appointment_at::date = current_date AND a.status <> 'CANCELLED') AS today_slots
        FROM users u
        LEFT JOIN appointments a ON a.doctor_id = u.id
        WHERE u.role = 'DOCTOR'
        GROUP BY u.id
        ORDER BY u.display_name ASC
      `,
    );
    res.json({ doctors: result.rows.map((doctor) => ({ ...doctor, specialization: doctor.profile?.specialization || 'Gynecology', consultationFee: Number(doctor.profile?.consultationFee || 800), todaySlots: Number(doctor.today_slots || 0) })) });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.post('/doctors', async (req, res, next) => {
  try {
    const displayName = String(req.body.displayName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const specialization = String(req.body.specialization || 'Gynecology').trim();
    const consultationFee = Number(req.body.consultationFee || 800);
    const passwordHash = await bcrypt.hash(String(req.body.password || 'doctor123'), 10);
    if (!displayName || !email) return res.status(400).json({ message: 'Doctor name and email are required.' });
    const saved = await pool.query(
      "INSERT INTO users (role, display_name, email, password_hash, profile, metadata) VALUES ('DOCTOR', $1, $2, $3, $4::jsonb, $5::jsonb) RETURNING id, display_name, email, status, profile",
      [displayName, email, passwordHash, JSON.stringify({ specialization, consultationFee, title: `${specialization} Specialist` }), JSON.stringify({ createdBy: 'admin_portal' })],
    );
    res.status(201).json({ doctor: saved.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A doctor with this email already exists.' });
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/doctors/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) return res.status(400).json({ message: 'Unsupported doctor status.' });
    const updated = await pool.query("UPDATE users SET status = $1, updated_at = now() WHERE id = $2 AND role = 'DOCTOR' RETURNING id, display_name, email, status, profile", [status, req.params.id]);
    if (!updated.rowCount) return res.status(404).json({ message: 'Doctor not found.' });
    res.json({ doctor: updated.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/patients', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const result = await pool.query(
      `
        SELECT id, display_name, email, phone, status, profile, created_at
        FROM users
        WHERE role = 'PATIENT' AND ($1 = '' OR display_name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
        ORDER BY created_at DESC LIMIT 100
      `,
      [q, `%${q}%`],
    );
    const stats = await pool.query("SELECT count(*) AS total_patients, count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS new_this_week FROM users WHERE role = 'PATIENT'");
    res.json({ patients: result.rows, stats: stats.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/payments', async (_req, res, next) => {
  try {
    const summary = await pool.query(
      `
        SELECT COALESCE(sum(amount) FILTER (WHERE created_at::date = current_date AND status = 'PAID'), 0) AS today,
               COALESCE(sum(amount) FILTER (WHERE status = 'PENDING'), 0) AS pending,
               COALESCE(sum(amount) FILTER (WHERE status = 'REFUNDED'), 0) AS refunded
        FROM payments
      `,
    );
    const payments = await pool.query(
      `
        SELECT p.*, u.display_name AS patient_name, a.service_type, a.appointment_at
        FROM payments p
        LEFT JOIN users u ON u.id = p.patient_id
        LEFT JOIN appointments a ON a.id = p.appointment_id
        ORDER BY p.created_at DESC LIMIT 100
      `,
    );
    res.json({ summary: { today: Number(summary.rows[0].today || 0), pending: Number(summary.rows[0].pending || 0), refunded: Number(summary.rows[0].refunded || 0) }, payments: payments.rows });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/payments/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(status)) return res.status(400).json({ message: 'Unsupported payment status.' });
    const updated = await pool.query('UPDATE payments SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *', [status, JSON.stringify({ updatedBy: 'admin_portal', updatedAt: new Date().toISOString() }), req.params.id]);
    if (!updated.rowCount) return res.status(404).json({ message: 'Payment not found.' });
    res.json({ payment: updated.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/settings/attributes', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM entity_attributes ORDER BY entity_type, label');
    res.json({ attributes: result.rows });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

module.exports = { adminRouter: router };
