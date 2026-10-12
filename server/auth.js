const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const { pool, isDbUnavailable } = require('./db');

const router = express.Router();


function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').trim();
}

function normalizeIndianMobile(phone) {
  const digits = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
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

function setRoleSession(req, user) {
  if (!user?.role) return;
  if (user.role === 'PATIENT') req.session.patientUser = user;
  if (user.role === 'DOCTOR') {
    req.session.doctorUser = user;
    req.session.doctorLastSeen = Date.now();
  }
  if (user.role === 'ADMIN') req.session.adminUser = user;
  req.session.user = user;
}

function getRoleSession(req, role) {
  if (role === 'PATIENT') return req.session.patientUser || (req.session.user?.role === 'PATIENT' ? req.session.user : null);
  if (role === 'DOCTOR') {
    if (req.session.doctorUser && req.session.doctorLastSeen && Date.now() - req.session.doctorLastSeen > 15 * 60 * 1000) {
      delete req.session.doctorUser;
      delete req.session.doctorLastSeen;
      if (req.session.user?.role === 'DOCTOR') delete req.session.user;
      return null;
    }
    return req.session.doctorUser || (req.session.user?.role === 'DOCTOR' ? req.session.user : null);
  }
  if (role === 'ADMIN') return req.session.adminUser || (req.session.user?.role === 'ADMIN' ? req.session.user : null);
  return req.session.user || null;
}

router.post('/patient/request-otp', async (req, res) => {
  const phone = normalizeIndianMobile(req.body.phone);
  const whatsappNumber = normalizeIndianMobile(req.body.whatsappNumber || req.body.phone);
  if (!phone) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number without +91.' });

  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const userResult = await client.query(
      `
        SELECT *
        FROM users
        WHERE role = 'PATIENT'
          AND status = 'ACTIVE'
          AND (
            regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1
            OR regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
          )
          AND email IS NOT NULL
        LIMIT 1
      `,
      [phone, `91${phone}`],
    );
    if (!userResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'This mobile number is not registered. Please register as a patient first.', redirectTo: '/patient/register.html' });
    }
    await client.query('UPDATE users SET profile = profile || $2::jsonb, updated_at = now() WHERE id = $1', [
      userResult.rows[0].id,
      JSON.stringify({ lastOtpRequestedAt: new Date().toISOString(), whatsappNumber: whatsappNumber || phone }),
    ]);
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
      return res.status(503).json({ message: 'PostgreSQL is not connected. Registered patient login cannot be verified.' });
    }
    res.status(500).json({ message: 'Could not generate OTP.', detail: error.message || error.code || error.name });
  } finally {
    if (client) client.release();
  }
});

router.post('/patient/register', async (req, res) => {
  const displayName = String(req.body.name || '').trim();
  const age = Number(req.body.age);
  const phone = normalizeIndianMobile(req.body.mobile || req.body.phone);
  const email = normalizeEmail(req.body.email);
  const history = String(req.body.history || '').trim();
  const allergies = String(req.body.allergies || '').trim();
  const diabetes = parseBoolean(req.body.diabetes);
  const bloodPressure = parseBoolean(req.body.bloodPressure || req.body.bp);
  const otherConditions = String(req.body.otherConditions || '').trim();

  if (!/^[A-Za-z][A-Za-z\s.'-]{1,79}$/.test(displayName)) return res.status(400).json({ message: 'Enter a valid full name.' });
  if (!Number.isInteger(age) || age < 1 || age > 120) return res.status(400).json({ message: 'Enter a valid age.' });
  if (!phone) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number without +91.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });

  const profile = {
    age,
    medicalHistory: history || null,
    allergies: allergies || null,
    conditions: {
      diabetes,
      bloodPressure,
      other: otherConditions || null,
    },
    onboardingStatus: 'REGISTERED',
    registeredAt: new Date().toISOString(),
  };

  try {
    const result = await pool.query(
      `
        INSERT INTO users (role, display_name, email, phone, profile, metadata)
        VALUES ('PATIENT', $1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (phone) WHERE phone IS NOT NULL
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          profile = users.profile || EXCLUDED.profile,
          metadata = users.metadata || EXCLUDED.metadata,
          status = 'ACTIVE',
          updated_at = now()
        RETURNING id, display_name, email, phone, profile
      `,
      [displayName, email, phone, JSON.stringify(profile), JSON.stringify({ source: 'patient_registration' })],
    );
    res.status(201).json({
      message: 'Registration completed. Please login with your mobile number.',
      redirectTo: '/patient/login.html?registered=1',
      patient: publicUser(result.rows[0]),
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'This email or mobile number is already registered with another patient.' });
    }
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected. Registration data could not be saved.' });
    res.status(500).json({ message: 'Could not register patient.', detail: error.message || error.code || error.name });
  }
});

router.post('/patient/verify-otp', async (req, res) => {
  const phone = normalizeIndianMobile(req.body.phone);
  const otp = String(req.body.otp || '').trim();
  if (!phone) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number without +91.' });

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
  const patientUser = publicUser({
    id: challenge.auth_user_id,
    role: challenge.role,
    display_name: challenge.display_name,
    email: challenge.email,
    phone: challenge.phone,
    profile: challenge.profile,
  });
  setRoleSession(req, patientUser);
  res.json({ redirectTo: '/patient/dashboard.html', user: patientUser });
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
      return res.status(503).json({ message: 'PostgreSQL is not connected. Staff login cannot be verified.' });
    }
    throw error;
  }

  if (!result.rowCount) return res.status(401).json({ message: 'Invalid login details.' });
  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash || '');
  if (!ok) return res.status(401).json({ message: 'Invalid login details.' });
  const staffUser = publicUser(user);
  setRoleSession(req, staffUser);
  res.json({ redirectTo: role === 'ADMIN' ? '/admin/dashboard.html' : '/doctor/dashboard.html', user: staffUser });
});

router.post('/logout', (req, res) => {
  const role = String(req.body.role || req.query.role || '').toUpperCase();
  if (role === 'PATIENT') {
    delete req.session.patientUser;
    if (req.session.user?.role === 'PATIENT') delete req.session.user;
    return res.json({ redirectTo: '/patient/login.html' });
  }
  if (role === 'DOCTOR') {
    delete req.session.doctorUser;
    delete req.session.doctorLastSeen;
    if (req.session.user?.role === 'DOCTOR') delete req.session.user;
    return res.json({ redirectTo: '/staff/login.html' });
  }
  if (role === 'ADMIN') {
    delete req.session.adminUser;
    if (req.session.user?.role === 'ADMIN') delete req.session.user;
    return res.json({ redirectTo: '/staff/login.html' });
  }
  req.session.destroy(() => res.json({ redirectTo: '/website/index.html' }));
});

router.get('/me', (req, res) => {
  const role = String(req.query.role || '').toUpperCase();
  const user = getRoleSession(req, role);
  if (user?.role === 'DOCTOR') req.session.doctorLastSeen = Date.now();
  res.json({ user });
});

module.exports = { authRouter: router };
