require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { pool } = require('./server/db');
const { authRouter } = require('./server/auth');
const { patientRouter } = require('./server/patient');
const { doctorRouter } = require('./server/doctor');
const { adminRouter } = require('./server/admin');
const { requireRole } = require('./server/access');

const app = express();
const port = Number(process.env.PORT || 5177);
const rootDir = __dirname;
const flutterDashboardDir = path.join(rootDir, 'flutter_dashboard', 'build', 'web');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const usePgSession = process.env.USE_PG_SESSION === 'true';
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 24 * 7);
const sessionStore = usePgSession
  ? new (require('connect-pg-simple')(session))({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    })
  : undefined;

app.use(
  session({
    name: 'aura.sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      maxAge: sessionMaxAgeMs,
    },
  }),
);

app.use('/api/auth', authRouter);
app.use('/api/patient', requireRole('PATIENT'), patientRouter);
app.use('/api/doctor', requireRole('DOCTOR'), doctorRouter);
app.use('/api/admin', requireRole('ADMIN'), adminRouter);
app.get(['/dashboard-app', '/dashboard-app/'], (req, res, next) => {
  const role = String(req.query.role || '').toLowerCase();
  if (role === 'doctor') return res.redirect('/doctor/dashboard.html');
  if (role === 'patient') return res.redirect('/patient/dashboard.html');
  next();
});
app.use('/dashboard-app', express.static(flutterDashboardDir));
app.get(/^\/dashboard-app(?:\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(flutterDashboardDir, 'index.html'));
});
app.use(express.static(rootDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.use((error, _req, res, _next) => {
  const detail = error.message || error.code || 'Unexpected server error';
  const status = error.status || (error.name === 'MulterError' ? 400 : 500);
  res.status(status).json({
    message: status === 400 ? detail : 'Server error. Check database connection and server logs.',
    detail,
  });
});

async function ensurePerformanceIndexes() {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_at ON appointments (doctor_id, appointment_at);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_at ON appointments (patient_id, appointment_at DESC);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created ON prescriptions (patient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_dates ON medical_documents (patient_id, document_date DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor_date ON doctor_availability (doctor_id, available_date);
    `);
  } catch (error) {
    console.warn('Performance indexes were not prepared:', error.code || error.message);
  }
}

async function ensureDefaultAdmin() {
  if (process.env.DISABLE_DEFAULT_ADMIN === 'true') return;
  try {
    const passwordHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
    await pool.query(
      `
        INSERT INTO users (role, display_name, email, password_hash, profile, metadata)
        VALUES ('ADMIN', $1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (email) WHERE email IS NOT NULL
        DO UPDATE SET
          role = 'ADMIN',
          status = 'ACTIVE',
          password_hash = EXCLUDED.password_hash,
          profile = users.profile || EXCLUDED.profile,
          metadata = users.metadata || EXCLUDED.metadata,
          updated_at = now()
      `,
      [
        process.env.DEFAULT_ADMIN_NAME || 'Super Admin',
        process.env.DEFAULT_ADMIN_EMAIL || 'admin@aura.test',
        passwordHash,
        JSON.stringify({ dashboard: 'admin', permissions: ['*'] }),
        JSON.stringify({ seed: true, source: 'server_startup_default_admin' }),
      ],
    );
  } catch (error) {
    console.warn('Default admin was not prepared:', error.code || error.message);
  }
}

async function start() {
  await Promise.all([ensurePerformanceIndexes(), ensureDefaultAdmin()]);
  app.listen(port, () => {
    console.log(`Sumohan Care app running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Sumohan Care app failed to start.');
  console.error(error.message || error.code || error.name);
  process.exit(1);
});
