const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool, isDbUnavailable } = require('./db');
const { createConsultationMeeting } = require('./meeting');

const router = express.Router();
const DEFAULT_SLOTS = generateSlots([
  ['09:00', '12:00'],
  ['13:00', '17:00'],
  ['18:00', '20:00'],
]);
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

function generateSlots(ranges) {
  const slots = [];
  ranges.forEach(([start, end]) => {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    let cursor = startHour * 60 + startMinute;
    const endAt = endHour * 60 + endMinute;
    while (cursor <= endAt) {
      const hour24 = Math.floor(cursor / 60);
      const minute = cursor % 60;
      const period = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 || 12;
      slots.push(`${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`);
      cursor += 15;
    }
  });
  return slots;
}

const allowedUploadTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedUploadTypes.has(file.mimetype)) return cb(null, true);
    const error = new Error('Only PDF, image, or text medical documents are allowed.');
    error.status = 400;
    return cb(error);
  },
});


async function getPatient(req) {
  const user = req.session.user?.role === 'PATIENT' ? req.session.user : null;
  if (!user) return null;

  const clauses = [];
  const params = ['PATIENT'];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id || '')) {
    params.push(user.id);
    clauses.push(`id = $${params.length}::uuid`);
  }
  if (user.phone) {
    params.push(user.phone);
    clauses.push(`phone = $${params.length}`);
  }
  if (user.email) {
    params.push(String(user.email).toLowerCase());
    clauses.push(`lower(email) = $${params.length}`);
  }
  if (!clauses.length) return null;

  const result = await pool.query(
    `SELECT id, display_name, phone, email, profile FROM users WHERE role = $1 AND (${clauses.join(' OR ')}) LIMIT 1`,
    params,
  );
  if (result.rowCount) return result.rows[0];

  if (!user.phone) return null;
  const repaired = await pool.query(
    `
      INSERT INTO users (role, display_name, email, phone, profile, metadata)
      VALUES ('PATIENT', $1, $2, $3, $4::jsonb, $5::jsonb)
      ON CONFLICT (phone) WHERE phone IS NOT NULL
      DO UPDATE SET
        display_name = COALESCE(NULLIF(users.display_name, 'Patient'), EXCLUDED.display_name),
        email = COALESCE(users.email, EXCLUDED.email),
        profile = users.profile || EXCLUDED.profile,
        updated_at = now()
      RETURNING id, display_name, phone, email, profile
    `,
    [
      user.displayName || user.display_name || 'Patient',
      user.email || null,
      user.phone,
      JSON.stringify({ ...(user.profile || {}), repairedFromSession: true }),
      JSON.stringify({ source: 'session_patient_repair' }),
    ],
  );
  return repaired.rows[0] || null;
}

function serviceForReason(reason) {
  const normalized = String(reason || '').toLowerCase();
  if (normalized.includes('pregnancy')) return 'Pregnancy Consultation';
  if (normalized.includes('pcod') || normalized.includes('pcos')) return 'Hormonal Health Consultation';
  if (normalized.includes('menstrual')) return 'Menstrual Health Consultation';
  if (normalized.includes('fertility')) return 'Fertility Consultation';
  if (normalized.includes('general')) return 'General Gynecology Consultation';
  return 'Gynecology Consultation';
}

function to24HourTime(timeLabel) {
  const match = String(timeLabel || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}:00`;
}

function assertFutureSlot(date, time) {
  const time24 = to24HourTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time24) {
    const error = new Error('A valid future date and slot are required.');
    error.status = 400;
    throw error;
  }
  const appointmentAt = new Date(`${date}T${time24}+05:30`);
  if (appointmentAt.getTime() <= Date.now()) {
    const error = new Error('Choose a date and slot later than the current time.');
    error.status = 400;
    throw error;
  }
  return appointmentAt;
}

function monthBounds(monthValue) {
  const now = new Date();
  const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`,
  };
}

async function getDoctors() {
  const result = await pool.query(
    `
      SELECT id, display_name, email, profile
      FROM users
      WHERE role = 'DOCTOR' AND status = 'ACTIVE'
      ORDER BY display_name ASC
    `,
  );
  return result.rows.map((doctor) => ({
    id: doctor.id,
    name: doctor.display_name,
    email: doctor.email,
    specialization: doctor.profile?.specialization || 'Gynecology',
    title: doctor.profile?.title || `Senior ${doctor.profile?.specialization || 'Gynecologist'}`,
    consultationFee: Number(doctor.profile?.consultationFee || 800),
    profile: doctor.profile || {},
  }));
}

async function getPatientAppointment(req, appointmentId) {
  const patient = await getPatient(req);
  if (!patient) return { patient: null, appointment: null };
  const result = await pool.query(
    'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 LIMIT 1',
    [appointmentId, patient.id],
  );
  return { patient, appointment: result.rows[0] || null };
}

async function assertSlotAvailable(doctorId, date, time, excludeAppointmentId) {
  const time24 = to24HourTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time24) {
    const error = new Error('A valid date and slot are required.');
    error.status = 400;
    throw error;
  }
  assertFutureSlot(date, time);
  const availability = await pool.query(
    'SELECT is_available, slots FROM doctor_availability WHERE doctor_id = $1 AND available_date = $2::date LIMIT 1',
    [doctorId, date],
  );
  const availableSlots = availability.rowCount ? availability.rows[0].slots : DEFAULT_SLOTS;
  if (availability.rowCount && !availability.rows[0].is_available) {
    const error = new Error('Doctor is not available on the selected date.');
    error.status = 409;
    throw error;
  }
  if (!availableSlots.includes(time)) {
    const error = new Error('Selected slot is not available for this doctor.');
    error.status = 409;
    throw error;
  }
  const appointmentAt = `${date}T${time24}+05:30`;
  const conflict = await pool.query(
    `
      SELECT id FROM appointments
      WHERE doctor_id = $1 AND appointment_at = $2::timestamptz AND status <> 'CANCELLED'
        AND ($3::uuid IS NULL OR id <> $3::uuid)
      LIMIT 1
    `,
    [doctorId, appointmentAt, excludeAppointmentId || null],
  );
  if (conflict.rowCount) {
    const error = new Error('Selected slot has already been booked.');
    error.status = 409;
    throw error;
  }
  return appointmentAt;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const [upcoming, history, prescriptions, reports] = await Promise.all([
      pool.query(
        `
          SELECT a.*, d.display_name AS doctor_name, d.profile AS doctor_profile
          FROM appointments a
          LEFT JOIN users d ON d.id = a.doctor_id
          WHERE a.patient_id = $1 AND a.appointment_at::date >= current_date AND a.status <> 'CANCELLED'
          ORDER BY a.appointment_at ASC
          LIMIT 1
        `,
        [patient.id],
      ),
      pool.query(
        `
          SELECT a.id, a.appointment_at, a.service_type, a.status, a.metadata, d.display_name AS doctor_name
          FROM appointments a
          LEFT JOIN users d ON d.id = a.doctor_id
          WHERE a.patient_id = $1
          ORDER BY a.appointment_at DESC
          LIMIT 10
        `,
        [patient.id],
      ),
      pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5', [patient.id]),
      pool.query(
        `
          SELECT id, document_type, name, document_date::text AS document_date, file_name, status, created_at
          FROM medical_documents
          WHERE patient_id = $1
          ORDER BY COALESCE(document_date, created_at::date) DESC, created_at DESC
          LIMIT 8
        `,
        [patient.id],
      ),
    ]);
    res.json({
      patient: { id: patient.id, name: patient.display_name, phone: patient.phone, email: patient.email, profile: patient.profile || {} },
      upcoming: upcoming.rows[0] || null,
      history: history.rows,
      prescriptions: prescriptions.rows,
      reports: reports.rows,
      storage: 'postgres',
    });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/appointments', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const result = await pool.query(
      `
        SELECT a.id, a.appointment_at, a.service_type, a.status, a.location, a.metadata,
               d.display_name AS doctor_name,
               p.id AS payment_id, p.amount AS payment_amount, p.currency AS payment_currency, p.status AS payment_status
        FROM appointments a
        LEFT JOIN users d ON d.id = a.doctor_id
        LEFT JOIN LATERAL (
          SELECT id, amount, currency, status FROM payments
          WHERE appointment_id = a.id
          ORDER BY created_at DESC
          LIMIT 1
        ) p ON true
        WHERE a.patient_id = $1
        ORDER BY a.appointment_at DESC
      `,
      [patient.id],
    );
    res.json({ appointments: result.rows });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/appointments/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['CANCELLED', 'COMPLETED'].includes(status)) return res.status(400).json({ message: 'Unsupported appointment action.' });
    const { appointment } = await getPatientAppointment(req, req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const updated = await pool.query('UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [status, appointment.id]);
    res.json({ appointment: updated.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/appointments/:id/reschedule', async (req, res, next) => {
  try {
    const { appointment } = await getPatientAppointment(req, req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    if (appointment.status === 'CANCELLED') return res.status(409).json({ message: 'Cancelled appointments cannot be rescheduled.' });
    const appointmentAt = await assertSlotAvailable(appointment.doctor_id, String(req.body.date || '').trim(), String(req.body.time || '').trim(), appointment.id);
    const updated = await pool.query(
      "UPDATE appointments SET appointment_at = $1::timestamptz, status = 'SCHEDULED', metadata = metadata || $2::jsonb, updated_at = now() WHERE id = $3 RETURNING *",
      [appointmentAt, JSON.stringify({ rescheduledBy: 'patient', rescheduledAt: new Date().toISOString() }), appointment.id],
    );
    res.json({ appointment: updated.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

router.post('/appointments/:id/feedback', async (req, res, next) => {
  try {
    const rating = Number(req.body.rating || 0);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Select a rating from 1 to 5 stars.' });
    const { appointment } = await getPatientAppointment(req, req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const feedback = { rating, comment, submittedAt: new Date().toISOString(), submittedBy: 'patient' };
    const updated = await pool.query("UPDATE appointments SET metadata = jsonb_set(metadata, '{feedback}', $1::jsonb, true), updated_at = now() WHERE id = $2 RETURNING id, metadata", [
      JSON.stringify(feedback),
      appointment.id,
    ]);
    res.json({ appointment: updated.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    res.json({ patient });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/profile', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });

    const displayName = String(req.body.name || req.body.displayName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const ageValue = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
    const gender = String(req.body.gender || '').trim();
    const genderValue = gender || null;

    if (!/^[A-Za-z][A-Za-z\s.'-]{1,79}$/.test(displayName)) return res.status(400).json({ message: 'Enter a valid full name.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120)) return res.status(400).json({ message: 'Enter a valid age.' });
    if (genderValue && !['Male', 'Female', 'Prefer not to say'].includes(genderValue)) return res.status(400).json({ message: 'Select a valid gender option.' });

    const profilePatch = {
      age: ageValue,
      gender: genderValue,
      permanentAddress: String(req.body.address || req.body.permanentAddress || '').trim() || null,
      bloodGroup: String(req.body.bloodGroup || req.body.bloodType || '').trim() || null,
      allergies: String(req.body.allergies || '').trim() || null,
      medicalHistory: String(req.body.history || req.body.medicalHistory || '').trim() || null,
      conditions: {
        ...(patient.profile?.conditions || {}),
        diabetes: req.body.diabetes === true || req.body.diabetes === 'true' || req.body.diabetes === 'on',
        bloodPressure: req.body.bloodPressure === true || req.body.bloodPressure === 'true' || req.body.bloodPressure === 'on',
        other: String(req.body.otherConditions || '').trim() || null,
      },
      updatedAt: new Date().toISOString(),
    };

    const result = await pool.query(
      `
        UPDATE users
        SET display_name = $1,
            email = $2,
            profile = profile || $3::jsonb,
            updated_at = now()
        WHERE id = $4 AND role = 'PATIENT'
        RETURNING id, role, display_name, phone, email, profile
      `,
      [displayName, email, JSON.stringify(profilePatch), patient.id],
    );
    const updated = result.rows[0];
    req.session.patientUser = {
      id: updated.id,
      role: updated.role,
      displayName: updated.display_name,
      email: updated.email,
      phone: updated.phone,
      profile: updated.profile || {},
    };
    if (req.session.user?.role === 'PATIENT') req.session.user = req.session.patientUser;
    res.json({ patient: updated });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'This email is already registered with another patient.' });
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const [reports, prescriptions] = await Promise.all([
      pool.query(
        'SELECT id, document_type, name, document_date::text AS document_date, file_name, status, created_at FROM medical_documents WHERE patient_id = $1 ORDER BY COALESCE(document_date, created_at::date) DESC, created_at DESC',
        [patient.id],
      ),
      pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [patient.id]),
    ]);
    res.json({ reports: reports.rows, prescriptions: prescriptions.rows });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.post('/documents', upload.single('file'), async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const documentType = String(req.body.documentType || 'REPORT').toUpperCase();
    if (!['REPORT', 'OLD_PRESCRIPTION'].includes(documentType)) return res.status(400).json({ message: 'Select report or old prescription.' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Document name is required.' });
    const fileMetadata = req.file
      ? {
          storage: 'database_base64',
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          base64: req.file.buffer.toString('base64'),
        }
      : null;
    const saved = await pool.query(
      `
        INSERT INTO medical_documents (patient_id, uploaded_by, document_type, name, document_date, file_name, file_path, mime_type, metadata)
        VALUES ($1, $1, $2, $3, $4::date, $5, $6, $7, $8::jsonb)
        RETURNING id, document_type, name, document_date::text AS document_date, file_name, status, created_at
      `,
      [
        patient.id,
        documentType,
        name,
        String(req.body.documentDate || '').trim() || null,
        req.file?.originalname || null,
        null,
        req.file?.mimetype || null,
        JSON.stringify({ uploadedDuring: req.body.uploadedDuring || 'patient_portal', file: fileMetadata }),
      ],
    );
    res.status(201).json({ document: saved.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/documents/:id/download', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const result = await pool.query('SELECT file_path, file_name, mime_type, metadata FROM medical_documents WHERE id = $1 AND patient_id = $2 LIMIT 1', [req.params.id, patient.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Document file not found.' });
    const document = result.rows[0];
    const dbFile = document.metadata?.file;
    if (dbFile?.base64) {
      const buffer = Buffer.from(dbFile.base64, 'base64');
      res.type(dbFile.mimeType || document.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dbFile.originalName || document.file_name || 'medical-document')}"`);
      return res.send(buffer);
    }
    if (!document.file_path) return res.status(404).json({ message: 'Document file not found.' });
    const filename = path.basename(document.file_path);
    const absolutePath = path.resolve(uploadDir, filename);
    const safeUploadDir = path.resolve(uploadDir);
    if (!absolutePath.startsWith(safeUploadDir) || !fs.existsSync(absolutePath)) return res.status(404).json({ message: 'Document file not found.' });
    res.type(document.mime_type || 'application/octet-stream');
    res.download(absolutePath, document.file_name || filename);
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/booking', (req, res) => {
  const booking = req.session.booking || {};
  res.json({ booking: { ...booking, service: booking.service || serviceForReason(booking.reason) } });
});

router.get('/booking/doctors', async (_req, res, next) => {
  try {
    res.json({ doctors: await getDoctors() });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/booking/availability', async (req, res, next) => {
  try {
    const doctors = await getDoctors();
    const doctor = doctors.find((item) => item.id === req.query.doctorId) || doctors[0];
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const { start, end } = monthBounds(req.query.month);
    const availability = await pool.query(
      'SELECT available_date::text AS date, is_available, slots FROM doctor_availability WHERE doctor_id = $1 AND available_date >= $2::date AND available_date < $3::date ORDER BY available_date ASC',
      [doctor.id, start, end],
    );
    const booked = await pool.query(
      "SELECT appointment_at::date::text AS date, to_char(appointment_at, 'HH12:MI AM') AS slot FROM appointments WHERE doctor_id = $1 AND appointment_at >= $2::date AND appointment_at < $3::date AND status <> 'CANCELLED'",
      [doctor.id, start, end],
    );
    res.json({ doctorId: doctor.id, defaultSlots: DEFAULT_SLOTS, availability: availability.rows, booked: booked.rows });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.post('/booking/reason', (req, res) => {
  const service = String(req.body.service || '').trim();
  const reason = String(req.body.reason || '').trim();
  const otherReason = String(req.body.otherReason || '').trim();
  if (!reason) return res.status(400).json({ message: 'Reason is required.' });
  req.session.booking = { ...(req.session.booking || {}), service: service || serviceForReason(reason), reason, otherReason };
  res.json({ redirectTo: '/patient/book-slot.html', booking: req.session.booking });
});

router.post('/booking/details', (req, res) => {
  const service = String(req.body.service || '').trim();
  const reason = String(req.body.reason || '').trim();
  const otherReason = String(req.body.otherReason || '').trim();
  const doctorId = String(req.body.doctorId || '').trim();
  req.session.booking = {
    ...(req.session.booking || {}),
    ...(service ? { service } : {}),
    ...(reason ? { reason } : {}),
    ...(Object.prototype.hasOwnProperty.call(req.body, 'otherReason') ? { otherReason } : {}),
    ...(doctorId ? { doctorId } : {}),
  };
  res.json({ booking: req.session.booking });
});

router.post('/booking/slot', (req, res) => {
  try {
    const date = String(req.body.date || '').trim();
    const time = String(req.body.time || '').trim();
    assertFutureSlot(date, time);
    req.session.booking = { ...(req.session.booking || {}), date, time, paymentId: null };
    res.json({ booking: req.session.booking });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

async function bookingContext(req, body = {}) {
  const booking = {
    ...(req.session.booking || {}),
    date: String(body.date || '').trim() || req.session.booking?.date,
    time: String(body.time || '').trim() || req.session.booking?.time,
  };
  if (!booking.reason || !booking.date || !to24HourTime(booking.time)) {
    const error = new Error('Please select a reason, date, and slot before payment.');
    error.status = 400;
    throw error;
  }
  const patient = await getPatient(req);
  if (!patient) {
    const error = new Error('Patient record not found in database.');
    error.status = 404;
    throw error;
  }
  const doctorResult = await pool.query(
    `
      SELECT id, display_name, email, profile
      FROM users
      WHERE role = 'DOCTOR' AND status = 'ACTIVE' AND ($1::uuid IS NULL OR id = $1::uuid)
      ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1
    `,
    [booking.doctorId || null],
  );
  const doctor = doctorResult.rows[0];
  if (!doctor) {
    const error = new Error('Doctor record not found in database.');
    error.status = 404;
    throw error;
  }
  const appointmentAt = await assertSlotAvailable(doctor.id, booking.date, booking.time);
  const serviceType = booking.service || serviceForReason(booking.reason);
  const amount = Number(doctor.profile?.consultationFee || 800);
  return { booking, patient, doctor, appointmentAt, serviceType, amount };
}

router.post('/booking/payment', async (req, res, next) => {
  try {
    const { booking, patient, doctor, serviceType, amount } = await bookingContext(req, req.body);
    const payment = await pool.query(
      `
        INSERT INTO payments (appointment_id, patient_id, amount, currency, status, metadata)
        VALUES (NULL, $1, $2, 'INR', 'PENDING', $3::jsonb)
        RETURNING *
      `,
      [
        patient.id,
        amount,
        JSON.stringify({
          source: 'patient_booking_flow',
          gateway: 'manual_demo',
          booking: {
            doctorId: doctor.id,
            doctorName: doctor.display_name,
            date: booking.date,
            time: booking.time,
            service: serviceType,
            reason: booking.reason,
            otherReason: booking.otherReason || null,
          },
        }),
      ],
    );
    req.session.booking = { ...booking, doctorId: doctor.id, paymentId: payment.rows[0].id };
    res.status(201).json({ payment: payment.rows[0], amount, currency: 'INR', message: 'Payment is ready. Complete payment to book this slot.' });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

router.patch('/booking/payment/:id/pay-and-book', async (req, res, next) => {
  let client;
  try {
    const { booking, patient, doctor, appointmentAt, serviceType, amount } = await bookingContext(req, req.body);
    const expectedPaymentId = req.session.booking?.paymentId;
    if (expectedPaymentId && expectedPaymentId !== req.params.id) return res.status(409).json({ message: 'This payment does not match the selected slot.' });

    client = await pool.connect();
    await client.query('BEGIN');
    const paid = await client.query(
      `
        UPDATE payments
        SET status = 'PAID', metadata = metadata || $1::jsonb
        WHERE id = $2 AND patient_id = $3 AND appointment_id IS NULL AND status = 'PENDING'
        RETURNING *
      `,
      [JSON.stringify({ paidAt: new Date().toISOString(), mode: 'manual_demo', reference: `SUMOHAN-${Date.now()}` }), req.params.id, patient.id],
    );
    if (!paid.rowCount) {
      const error = new Error('Pending booking payment not found.');
      error.status = 404;
      throw error;
    }

    const paymentBooking = paid.rows[0].metadata?.booking || {};
    const matchesSelection =
      paymentBooking.doctorId === doctor.id &&
      paymentBooking.date === booking.date &&
      paymentBooking.time === booking.time &&
      Number(paid.rows[0].amount) === Number(amount);
    if (!matchesSelection) {
      const error = new Error('Payment details do not match the selected slot.');
      error.status = 409;
      throw error;
    }

    const appointment = await client.query(
      `
        INSERT INTO appointments (doctor_id, patient_id, appointment_at, service_type, status, location, notes, metadata)
        VALUES ($1, $2, $3::timestamptz, $4, 'SCHEDULED', $5, $6::jsonb, $7::jsonb)
        RETURNING *
      `,
      [
        doctor.id,
        patient.id,
        appointmentAt,
        booking.service || serviceForReason(booking.reason),
        'Sumohan Care Main Clinic',
        JSON.stringify({ reason: booking.reason, otherReason: booking.otherReason || null }),
        JSON.stringify({ source: 'patient_booking_flow', flexible: true, fee: amount, paymentId: paid.rows[0].id }),
      ],
    );
    await client.query('UPDATE payments SET appointment_id = $1 WHERE id = $2', [appointment.rows[0].id, paid.rows[0].id]);
    const meeting = await createConsultationMeeting({ appointmentId: appointment.rows[0].id, appointmentAt, serviceType: appointment.rows[0].service_type, patient, doctor });
    const saved = await client.query('UPDATE appointments SET metadata = metadata || $1::jsonb WHERE id = $2 RETURNING *', [
      JSON.stringify({ virtualMeeting: meeting }),
      appointment.rows[0].id,
    ]);
    await client.query('COMMIT');
    req.session.booking = {};
    res.status(201).json({ redirectTo: '/patient/dashboard.html', appointment: saved.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  } finally {
    if (client) client.release();
  }
});

router.post('/booking/confirm', (_req, res) => {
  res.status(402).json({ message: 'Payment is required before booking this slot.' });
});

router.post('/appointments/:id/payment', async (req, res, next) => {
  try {
    const { patient, appointment } = await getPatientAppointment(req, req.params.id);
    if (!patient || !appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const amount = Number(req.body.amount || appointment.metadata?.fee || 800);
    const saved = await pool.query(
      "INSERT INTO payments (appointment_id, patient_id, amount, currency, status, metadata) VALUES ($1, $2, $3, 'INR', 'PENDING', $4::jsonb) RETURNING *",
      [appointment.id, patient.id, amount, JSON.stringify({ source: 'patient_portal', gateway: 'manual_placeholder' })],
    );
    res.status(201).json({ payment: saved.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/payments/:id/pay', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const updated = await pool.query(
      "UPDATE payments SET status = 'PAID', metadata = metadata || $1::jsonb WHERE id = $2 AND patient_id = $3 AND status = 'PENDING' RETURNING *",
      [JSON.stringify({ paidAt: new Date().toISOString(), mode: 'manual_demo', reference: `SUMOHAN-${Date.now()}` }), req.params.id, patient.id],
    );
    if (!updated.rowCount) return res.status(404).json({ message: 'Pending payment not found.' });
    res.json({ payment: updated.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/payments/:id/receipt', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const result = await pool.query(
      `
        SELECT p.*, a.service_type, a.appointment_at, d.display_name AS doctor_name
        FROM payments p
        LEFT JOIN appointments a ON a.id = p.appointment_id
        LEFT JOIN users d ON d.id = a.doctor_id
        WHERE p.id = $1 AND p.patient_id = $2
        LIMIT 1
      `,
      [req.params.id, patient.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Receipt not found.' });
    const payment = result.rows[0];
    res.type('text/plain').send([
      'Sumohan Care Payment Receipt',
      `Receipt ID: ${payment.id}`,
      `Patient: ${patient.display_name}`,
      `Doctor: ${payment.doctor_name || '-'}`,
      `Service: ${payment.service_type || '-'}`,
      `Appointment: ${payment.appointment_at || '-'}`,
      `Amount: ${payment.currency} ${payment.amount}`,
      `Status: ${payment.status}`,
    ].join('\n'));
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

module.exports = { patientRouter: router };
