require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
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
const sessionStore = usePgSession
  ? new (require('connect-pg-simple')(session))({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    })
  : undefined;

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use('/api/auth', authRouter);
app.use('/api/patient', requireRole('PATIENT'), patientRouter);
app.use('/api/doctor', requireRole('DOCTOR'), doctorRouter);
app.use('/api/admin', requireRole('ADMIN'), adminRouter);
app.use('/dashboard-app', express.static(flutterDashboardDir));
app.get(/^\/dashboard-app(?:\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(flutterDashboardDir, 'index.html'));
});
app.get('/patient/dashboard.html', (_req, res) => {
  res.redirect('/dashboard-app/?role=patient');
});
app.get('/doctor/dashboard.html', (_req, res) => {
  res.redirect('/dashboard-app/?role=doctor');
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

app.listen(port, () => {
  console.log(`Aura Health app running at http://localhost:${port}`);
});
