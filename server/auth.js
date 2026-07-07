const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const { pool } = require('./db');

const router = express.Router();
const devOtpChallenges = new Map();

function isDbUnavailable(error) {
  return error && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code);
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    role: user.role,
    displayName: user.display_name,
    email: user.email,
    phone: user.phone,
    profile: user.profile || {},
  };
}

router.post('/patient/request-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const whatsappNumber = normalizePhone(req.body.whatsappNumber || req.body.phone);
  if (!phone || phone.length < 8) return res.status(400).json({ message: 'Enter a valid mobile number.' });

  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const userResult = await client.query(
      `
        INSERT INTO users (role, phone, display_name, profile, metadata)
        VALUES ('PATIENT', $1, 'Patient', $2, $3)
        ON CONFLICT (phone) WHERE phone IS NOT NULL
        DO UPDATE SET profile = users.profile || EXCLUDED.profile, updated_at = now()
        RETURNING *
      `,
      [phone, { onboardingStatus: 'OTP_REQUESTED', whatsappNumber }, { source: 'patient_otp_login' }],
    );
    await client.query(
      `
        INSERT INTO otp_challenges (user_id, destination, channel, otp_code, expires_at, metadata)
        VALUES ($1, $2, 'SCREEN', $3, $4, $5)
      `,
      [userResult.rows[0].id, phone, otp, expiresAt, { deliveryMode: 'show_on_screen_for_dev' }],
    );
    await client.query('COMMIT');
    res.json({ message: 'OTP generated. In production this will be sent over SMS or WhatsApp.', otp, expiresAt });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (isDbUnavailable(error)) {
      devOtpChallenges.set(phone, {
        otp,
        expiresAt,
        user: {
          id: `dev-patient-${phone}`,
          role: 'PATIENT',
          displayName: 'Patient',
          email: null,
          phone,
          profile: { onboardingStatus: 'OTP_REQUESTED', whatsappNumber, storage: 'memory_fallback' },
        },
      });
      return res.json({ message: 'OTP generated in development memory because PostgreSQL is not reachable.', otp, expiresAt, storage: 'memory' });
    }
    res.status(500).json({ message: 'Could not generate OTP.', detail: error.message || error.code || error.name });
  } finally {
    if (client) client.release();
  }
});

router.post('/patient/verify-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || '').trim();

  const devChallenge = devOtpChallenges.get(phone);
  if (devChallenge) {
    if (devChallenge.otp !== otp || new Date(devChallenge.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ message: 'Invalid or expired OTP.' });
    }
    devOtpChallenges.delete(phone);
    req.session.user = devChallenge.user;
    return res.json({ redirectTo: '/dashboard-app/?role=patient', user: req.session.user, storage: 'memory' });
  }

  const result = await pool.query(
    `
      SELECT oc.*, u.id AS auth_user_id, u.role, u.display_name, u.email, u.phone, u.profile
      FROM otp_challenges oc
      JOIN users u ON u.id = oc.user_id
      WHERE oc.destination = $1
        AND oc.otp_code = $2
        AND oc.consumed_at IS NULL
        AND oc.expires_at > now()
      ORDER BY oc.created_at DESC
      LIMIT 1
    `,
    [phone, otp],
  );

  if (!result.rowCount) return res.status(401).json({ message: 'Invalid or expired OTP.' });
  const challenge = result.rows[0];
  await pool.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);
  await pool.query('UPDATE users SET profile = profile || $2::jsonb, updated_at = now() WHERE id = $1', [
    challenge.user_id,
    JSON.stringify({ onboardingStatus: 'OTP_VERIFIED' }),
  ]);
  req.session.user = publicUser({
    id: challenge.auth_user_id,
    role: challenge.role,
    display_name: challenge.display_name,
    email: challenge.email,
    phone: challenge.phone,
    profile: challenge.profile,
  });
  res.json({ redirectTo: '/dashboard-app/?role=patient', user: req.session.user });
});

router.post('/staff/login', async (req, res) => {
  const role = String(req.body.role || 'DOCTOR').toUpperCase();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!['ADMIN', 'DOCTOR'].includes(role)) return res.status(400).json({ message: 'Select doctor or admin.' });

  let result;
  try {
    result = await pool.query('SELECT * FROM users WHERE lower(email) = $1 AND role = $2 AND status = $3 LIMIT 1', [email, role, 'ACTIVE']);
  } catch (error) {
    if (isDbUnavailable(error)) {
      const seedLogin =
        (role === 'DOCTOR' && email === 'doctor@aura.test' && password === 'doctor123') ||
        (role === 'ADMIN' && email === 'admin@aura.test' && password === 'admin123');
      if (!seedLogin) return res.status(401).json({ message: 'Invalid login details.' });
      req.session.user = {
        id: `dev-${role.toLowerCase()}`,
        role,
        displayName: role === 'ADMIN' ? 'Super Admin' : 'Dr. Elena Rossi',
        email,
        phone: null,
        profile: { storage: 'memory_fallback' },
      };
      return res.json({ redirectTo: role === 'ADMIN' ? '/admin/dashboard.html' : '/dashboard-app/?role=doctor', user: req.session.user, storage: 'memory' });
    }
    throw error;
  }

  if (!result.rowCount) return res.status(401).json({ message: 'Invalid login details.' });
  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash || '');
  if (!ok) return res.status(401).json({ message: 'Invalid login details.' });
  req.session.user = publicUser(user);
  res.json({ redirectTo: role === 'ADMIN' ? '/admin/dashboard.html' : '/dashboard-app/?role=doctor', user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ redirectTo: '/website/index.html' }));
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = { authRouter: router };
