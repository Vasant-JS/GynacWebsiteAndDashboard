const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool, isDbUnavailable } = require('./db');
const { createConsultationMeeting } = require('./meeting');
const { changeAppointment } = require('./appointment-changes');
const categories = require('../assets/consultation-categories.json');

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
  if (!require('../assets/js/clinical-schema').dateValue(date) || !time24) {
    const error = new Error('A valid future date and slot are required.');
    error.status = 400;
    throw error;
  }
  const appointmentAt = new Date(`${date}T${time24}+05:30`);
  if (!Number.isFinite(appointmentAt.getTime()) || appointmentAt.getTime() <= Date.now()) {
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
      WHERE role = 'DOCTOR' AND status = 'ACTIVE' AND COALESCE(metadata->>'test', 'false') <> 'true'
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

async function assertSlotAvailable(doctorId, date, time, excludeAppointmentId, db = pool) {
  const time24 = to24HourTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time24) {
    const error = new Error('A valid date and slot are required.');
    error.status = 400;
    throw error;
  }
  assertFutureSlot(date, time);
  if(!DEFAULT_SLOTS.includes(time))throw Object.assign(new Error('Choose a hospital consultation time.'),{status:400});
  const appointmentAt = date+'T'+time24+'+05:30';
  return appointmentAt;
}
async function assertHospitalBookingSlot(patientId,date,time,excludeAppointmentId,db){
  const appointmentAt=await assertSlotAvailable(null,date,time);
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[patientId]);
  const duplicate=await db.query("SELECT id FROM appointments WHERE patient_id=$1 AND appointment_at=$2::timestamptz AND status<>'CANCELLED' AND ($3::uuid IS NULL OR id<>$3::uuid)",[patientId,appointmentAt,excludeAppointmentId || null]);
  if(duplicate.rowCount)throw Object.assign(new Error('You already have a consultation booked at this time.'),{status:409});
  return appointmentAt;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const [upcoming, history, prescriptions, reports, appointmentStats] = await Promise.all([
      pool.query(
        `
          SELECT a.*, d.display_name AS doctor_name, d.profile AS doctor_profile
          FROM appointments a
          LEFT JOIN users d ON d.id = a.attended_by
          WHERE a.patient_id = $1
            AND a.appointment_at >= now()
            AND a.status NOT IN ('CANCELLED', 'COMPLETED')
          ORDER BY a.appointment_at ASC
          LIMIT 1
        `,
        [patient.id],
      ),
      pool.query(
        `
          SELECT a.id, a.appointment_at, a.service_type, a.status, a.metadata, d.display_name AS doctor_name
          FROM appointments a
          LEFT JOIN users d ON d.id = a.attended_by
          WHERE a.patient_id = $1
            AND (a.appointment_at < now() OR a.status = 'COMPLETED')
            AND a.status <> 'CANCELLED'
          ORDER BY a.appointment_at DESC
          LIMIT 5
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
      pool.query(
        `SELECT
           count(*) FILTER (WHERE appointment_at >= now() AND status NOT IN ('CANCELLED', 'COMPLETED'))::int AS upcoming_count,
           count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
           count(*) FILTER (WHERE appointment_at < now() AND status <> 'CANCELLED')::int AS past_count,
           max(appointment_at) FILTER (WHERE appointment_at < now() AND status <> 'CANCELLED') AS last_visit_at
         FROM appointments WHERE patient_id = $1`,
        [patient.id],
      ),
    ]);
    res.json({
      patient: { id: patient.id, name: patient.display_name, phone: patient.phone, email: patient.email, profile: patient.profile || {} },
      upcoming: upcoming.rows[0] || null,
      history: history.rows,
      prescriptions: prescriptions.rows,
      reports: reports.rows,
      appointmentStats: appointmentStats.rows[0],
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
        LEFT JOIN users d ON d.id = a.attended_by
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
    const updated = await changeAppointment(appointment.id, 'PATIENT', appointment.patient_id, {status});
    res.json({ appointment: updated });
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
    const updated = await changeAppointment(appointment.id,'PATIENT',appointment.patient_id,{status:'SCHEDULED',prepareTime:(item,client)=>assertHospitalBookingSlot(item.patient_id,String(req.body.date || '').trim(),String(req.body.time || '').trim(),item.id,client)});
    res.json({ appointment: updated });
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
    const reportCategory = String(req.body.reportCategory || 'Other');
    if (!['Scan report', 'Blood investigation', 'Other'].includes(reportCategory)) return res.status(400).json({ message: 'Choose a report category.' });
    if (req.body.uploadedDuring === 'slot_booking' && (!req.file || !['application/pdf', 'image/jpeg', 'image/png'].includes(req.file.mimetype))) return res.status(400).json({ message: 'Choose a PDF, JPG or PNG report.' });
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
        JSON.stringify({ uploadedDuring: req.body.uploadedDuring || 'patient_portal', reportCategory, file: fileMetadata }),
      ],
    );
    if (req.body.uploadedDuring === 'slot_booking') req.session.booking = { ...(req.session.booking || {}), documentIds: [...new Set([...(req.session.booking?.documentIds || []), saved.rows[0].id])] };
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
  res.json({ booking: { ...booking, doctorId:null, service: booking.service || serviceForReason(booking.reason) } });
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
    res.json({defaultSlots:DEFAULT_SLOTS,availability:[],booked:[],bookingMode:'HOSPITAL_QUEUE'});
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.post('/booking/reason', async (req, res, next) => {
  const service = String(req.body.service || '').trim();
  const reason = String(req.body.reason || '').trim();
  const otherReason = String(req.body.otherReason || '').trim();
  if (!reason || reason.length > 4000) return res.status(400).json({ message: 'Enter a reason of up to 4,000 characters.' });
  if (!categories.includes(service)) return res.status(400).json({ message: 'Choose a valid consultation category.' });
  const consultationType = String(req.body.consultationType || 'NEW');
  if (!['NEW', 'FOLLOW_UP'].includes(consultationType)) return res.status(400).json({ message: 'Choose new or follow-up consultation.' });
  const previousAppointmentId = consultationType === 'FOLLOW_UP' ? String(req.body.previousAppointmentId || '') : null;
  const previousCaseReference = consultationType === 'FOLLOW_UP' ? String(req.body.previousCaseReference || '').trim() : '';
  if (previousCaseReference.length > 120) return res.status(400).json({ message: 'Previous case reference must be 120 characters or fewer.' });
  const doctorId = String(req.body.doctorId || '').trim();
  try {
    if (previousAppointmentId) {
      if (!/^[0-9a-f-]{36}$/i.test(previousAppointmentId)) return res.status(400).json({ message: 'Choose a previous consultation.' });
      const patient = await getPatient(req);
      const previous = await pool.query("SELECT id FROM appointments WHERE id = $1 AND patient_id = $2 AND status <> 'CANCELLED' AND appointment_at <= now()", [previousAppointmentId, patient?.id]);
      if (!previous.rowCount) return res.status(400).json({ message: 'Previous consultation is not available for this patient.' });
    } else if (consultationType === 'FOLLOW_UP' && !previousCaseReference) return res.status(400).json({ message: 'Choose a previous consultation or enter a hospital case reference for follow-up.' });
  } catch (error) { return next(error); }
  req.session.booking = { ...(req.session.booking || {}), service, reason, otherReason, consultationType, previousAppointmentId, previousCaseReference, doctorId: null, consent: null, paymentId: null };
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
    doctorId: null,
  };
  res.json({ booking: req.session.booking });
});

router.post('/booking/slot', (req, res) => {
  try {
    const date = String(req.body.date || '').trim();
    const time = String(req.body.time || '').trim();
    assertFutureSlot(date, time);
    req.session.booking = { ...(req.session.booking || {}), doctorId:null, date, time, paymentId: null };
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
  booking.doctorId=null;
  const fee=Number(process.env.HOSPITAL_CONSULTATION_FEE || 800);
  if(!Number.isFinite(fee)||fee<=0)throw Object.assign(new Error('Hospital consultation fee is not configured.'),{status:503});
  const doctor={id:null,display_name:'Sumohan Care clinical team',email:null,profile:{consultationFee:fee}};
  const appointmentAt = await assertSlotAvailable(doctor.id, booking.date, booking.time);
  const serviceType = booking.service || serviceForReason(booking.reason);
  const amount = Number(doctor.profile?.consultationFee || 800);
  return { booking, patient, doctor, appointmentAt, serviceType, amount };
}

router.post('/booking/payment', async (req, res, next) => {
  if (require('./razorpay').provider() !== 'demo') return res.status(409).json({message:'Demo payment is disabled. Use the configured checkout.'});
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

async function bookingDeclaration(booking, patient, body, client) {
  const invalid = message => Object.assign(new Error(message), { status: 400 });
  if (body.medicalConsent !== true || body.accuracyConsent !== true) throw invalid('Please acknowledge both patient declarations before booking.');
  const patientName = String(body.declarationName || '').trim();
  if (!patientName || patientName.length > 200 || patientName.toLowerCase() !== patient.display_name.trim().toLowerCase()) throw invalid('Declaration name must match the registered patient name.');
  if (!categories.includes(booking.service)) throw invalid('Choose a consultation category again.');
  if (!['NEW', 'FOLLOW_UP'].includes(booking.consultationType || 'NEW')) throw invalid('Choose new or follow-up consultation.');
  if (booking.consultationType === 'FOLLOW_UP') {
    if (booking.previousAppointmentId) {
      if (!/^[0-9a-f-]{36}$/i.test(booking.previousAppointmentId)) throw invalid('Choose a previous consultation.');
      const previous = await client.query("SELECT id FROM appointments WHERE id = $1 AND patient_id = $2 AND status <> 'CANCELLED' AND appointment_at <= now()", [booking.previousAppointmentId, patient.id]);
      if (!previous.rowCount) throw invalid('Previous consultation is not available for this patient.');
    } else if (!String(booking.previousCaseReference || '').trim() || String(booking.previousCaseReference).length > 120) throw invalid('Choose a previous consultation or enter a hospital case reference for follow-up.');
  }
  return { medicalInformation: true, informationAccuracy: true, patientName, declaredAt: new Date().toISOString(), policyVersion: '2026-10-14' };
}

function bookingHistoryMetadata(booking, consent) {
  const followUp = booking.consultationType === 'FOLLOW_UP';
  return { consultationType: followUp ? 'FOLLOW_UP' : 'NEW', previousAppointmentId: followUp ? booking.previousAppointmentId || null : null,
    previousCaseReference: followUp ? booking.previousCaseReference || null : null, consent };
}

router.patch('/booking/payment/:id/pay-and-book', async (req, res, next) => {
  if (require('./razorpay').provider() !== 'demo') return res.status(409).json({message:'Demo payment is disabled.'});
  let client;
  try {
    const { booking, patient, doctor, serviceType, amount } = await bookingContext(req, req.body);
    const expectedPaymentId = req.session.booking?.paymentId;
    if (expectedPaymentId && expectedPaymentId !== req.params.id) return res.status(409).json({ message: 'This payment does not match the selected slot.' });

    client = await pool.connect();
    await client.query('BEGIN');
    const consent = await bookingDeclaration(booking, patient, req.body, client);
    const appointmentAt = await assertHospitalBookingSlot(patient.id, booking.date, booking.time, null, client);
    const paid = await client.query(
      `
        UPDATE payments
        SET status = 'PAID', metadata = metadata || $1::jsonb
        WHERE id = $2 AND patient_id = $3 AND appointment_id IS NULL AND status = 'PENDING' AND metadata->>'gateway' = 'manual_demo'
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
        JSON.stringify({ source: 'patient_booking_flow', flexible: true, fee: amount, paymentId: paid.rows[0].id, ...bookingHistoryMetadata(booking, consent) }),
      ],
    );
    await client.query('UPDATE payments SET appointment_id = $1 WHERE id = $2', [appointment.rows[0].id, paid.rows[0].id]);
    if (booking.documentIds?.length) await client.query('UPDATE medical_documents SET appointment_id = $1 WHERE id = ANY($2::uuid[]) AND patient_id = $3 AND appointment_id IS NULL', [appointment.rows[0].id, booking.documentIds, patient.id]);
    await require('./attendance').notifyBooking(client,patient.id,appointment.rows[0].id,`${serviceType} on ${booking.date} at ${booking.time}`);
    await client.query('COMMIT');
    let meeting;
    try {
      meeting = await createConsultationMeeting({ appointmentId: appointment.rows[0].id, appointmentAt, durationMinutes: appointment.rows[0].duration_minutes, serviceType: appointment.rows[0].service_type, patient, doctor });
    } catch (error) {
      console.error('Google Meet creation failed:', error.message);
      meeting = { provider: 'google_meet', mode: 'failed', meetLink: null, createdAt: new Date().toISOString() };
    }
    const saved = await pool.query('UPDATE appointments SET metadata = metadata || $1::jsonb WHERE id = $2 RETURNING *', [JSON.stringify({ virtualMeeting: meeting }), appointment.rows[0].id]);
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

router.post('/booking/confirm', async (req, res, next) => {
  if (require('./razorpay').provider() === 'razorpay') return res.status(409).json({message:'Complete secure checkout to confirm this booking.'});
  let client;
  try {
    if (req.body.medicalConsent !== true || req.body.accuracyConsent !== true) return res.status(400).json({ message: 'Please acknowledge both patient declarations before booking.' });
    const { booking, patient, doctor, serviceType } = await bookingContext(req, req.body);
    client = await pool.connect();
    await client.query('BEGIN');
    const consent = await bookingDeclaration(booking, patient, req.body, client);
    const appointmentAt = await assertHospitalBookingSlot(patient.id, booking.date, booking.time, null, client);
    const saved = await client.query(`INSERT INTO appointments (doctor_id, patient_id, appointment_at, service_type, status, location, notes, metadata, duration_minutes)
      VALUES ($1, $2, $3::timestamptz, $4, 'SCHEDULED', 'Sumohan Hospital, Shivamogga', $5::jsonb, $6::jsonb, 15) RETURNING *`,
      [doctor.id, patient.id, appointmentAt, serviceType, JSON.stringify({ reason: booking.reason, otherReason: booking.otherReason || null }), JSON.stringify({ source: 'patient_booking_flow', ...bookingHistoryMetadata(booking, consent), paymentStatus: 'NOT_COLLECTED' })]);
    const appointment = saved.rows[0];
    if (booking.documentIds?.length) await client.query('UPDATE medical_documents SET appointment_id = $1 WHERE id = ANY($2::uuid[]) AND patient_id = $3 AND appointment_id IS NULL', [appointment.id, booking.documentIds, patient.id]);
    await require('./attendance').notifyBooking(client,patient.id,appointment.id,`${serviceType} on ${booking.date} at ${booking.time}`);
    await client.query('COMMIT');
    let meeting;
    try {
      meeting = await createConsultationMeeting({ appointmentId: appointment.id, appointmentAt, durationMinutes: appointment.duration_minutes, serviceType: appointment.service_type, patient, doctor });
    } catch (error) {
      console.error('Google Meet creation failed:', error.message);
      meeting = { provider: 'google_meet', mode: 'failed', meetLink: null, createdAt: new Date().toISOString() };
    }
    const withMeeting = await pool.query('UPDATE appointments SET metadata = metadata || $1::jsonb WHERE id = $2 RETURNING *', [JSON.stringify({ virtualMeeting: meeting }), appointment.id]);
    req.session.booking = {};
    res.status(201).json({ appointment: withMeeting.rows[0], redirectTo: '/patient/appointments.html', message: 'Consultation booked. No online payment was collected.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  } finally { if (client) client.release(); }
});

router.post('/appointments/:id/payment', async (req, res, next) => {
  if (require('./razorpay').provider() !== 'demo') return res.status(409).json({message:'Manual payment collection is disabled.'});
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
  if (require('./razorpay').provider() !== 'demo') return res.status(409).json({message:'Manual payment collection is disabled.'});
  try {
    const patient = await getPatient(req);
    if (!patient) return res.status(404).json({ message: 'Patient record not found in database.' });
    const updated = await pool.query(
      "UPDATE payments SET status = 'PAID', metadata = metadata || $1::jsonb WHERE id = $2 AND patient_id = $3 AND status = 'PENDING' AND COALESCE(metadata->>'gateway','') <> 'razorpay' RETURNING *",
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
        LEFT JOIN users d ON d.id = a.attended_by
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

router.use('/razorpay',require('./razorpay-payments').patientPaymentRouter);
module.exports = { patientRouter: router, bookingContext, bookingDeclaration, bookingHistoryMetadata, assertSlotAvailable,assertHospitalBookingSlot,defaultSlots:DEFAULT_SLOTS };
