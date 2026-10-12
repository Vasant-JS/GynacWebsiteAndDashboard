const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool, isDbUnavailable } = require('./db');

const router = express.Router();
const DEFAULT_SLOTS = generateSlots([
  ['09:00', '12:00'],
  ['13:00', '17:00'],
  ['18:00', '20:00'],
]);
const uploadDir = path.join(__dirname, '..', 'uploads');
const prescriptionPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    const error = new Error('Upload a JPEG, PNG, or WebP prescription photo.');
    error.status = 400;
    return cb(error);
  },
});
const SLOT_DURATION_MINUTES = 15;

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

function slotToMinutes(slot) {
  const match = String(slot || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function fromMinutes(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

function rangeFromSlot(slot) {
  const startMinutes = slotToMinutes(slot);
  return {
    start: slot,
    end: startMinutes == null ? '' : fromMinutes(startMinutes + SLOT_DURATION_MINUTES),
  };
}

function validateAvailabilitySlots(slots, slotRanges = []) {
  const ranges = Array.isArray(slotRanges) && slotRanges.length
    ? slotRanges.map((range) => ({ start: String(range.start || '').trim(), end: String(range.end || '').trim() }))
    : slots.map(rangeFromSlot);
  const filtered = ranges.filter((range) => range.start || range.end);
  const starts = filtered.map((range) => range.start);
  if (new Set(starts).size !== starts.length) return { ok: false, message: 'Duplicate slot start times are not allowed.' };
  const invalid = filtered.find((range) => slotToMinutes(range.start) == null || slotToMinutes(range.end) == null);
  if (invalid) return { ok: false, message: 'Enter a valid start and end time for every slot.' };
  const reversed = filtered.find((range) => slotToMinutes(range.end) <= slotToMinutes(range.start));
  if (reversed) return { ok: false, message: `${reversed.end} must be later than ${reversed.start}.` };
  const sorted = [...filtered].sort((left, right) => slotToMinutes(left.start) - slotToMinutes(right.start));
  for (let index = 1; index < sorted.length; index += 1) {
    if (slotToMinutes(sorted[index - 1].end) > slotToMinutes(sorted[index].start)) {
      return { ok: false, message: `${sorted[index - 1].start} - ${sorted[index - 1].end} overlaps with ${sorted[index].start} - ${sorted[index].end}.` };
    }
  }
  return { ok: true, ranges: sorted, slots: sorted.map((range) => range.start) };
}

function selectedAvailabilitySlots(slots, validStarts) {
  const available = new Set(validStarts);
  const selected = Array.from(new Set(slots)).filter((slot) => available.has(slot));
  return selected.sort((left, right) => slotToMinutes(left) - slotToMinutes(right));
}


async function currentDoctor(req) {
  const sessionDoctor = req.authUser?.role === 'DOCTOR' ? req.authUser : req.session.doctorUser;
  const doctorEmail = sessionDoctor?.email || 'doctor@aura.test';
  const doctorResult = await pool.query('SELECT id, display_name, email, profile FROM users WHERE role = $1 AND email = $2 LIMIT 1', ['DOCTOR', doctorEmail]);
  return doctorResult.rows[0] || null;
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

router.get('/dashboard', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const statsResult = await pool.query(
      `
        SELECT
          count(*) AS total_appointments,
          count(*) FILTER (WHERE appointment_at > now() AND status NOT IN ('CANCELLED', 'COMPLETED')) AS pending_appointments,
          count(*) FILTER (WHERE appointment_at < now() AND status NOT IN ('CANCELLED', 'COMPLETED')) AS missed_appointments,
          count(*) FILTER (WHERE appointment_at::date = current_date) AS todays_appointments,
          count(*) FILTER (WHERE appointment_at::date = current_date AND status = 'COMPLETED') AS consultations_done
        FROM appointments
        WHERE doctor_id = $1
      `,
      [doctor.id],
    );
    const prescriptionResult = await pool.query("SELECT count(*) AS pending_prescriptions FROM prescriptions WHERE doctor_id = $1 AND status IN ('DRAFT', 'PENDING_REVIEW')", [doctor.id]);
    const scheduleResult = await pool.query(
      `
        SELECT a.id, to_char(a.appointment_at, 'HH12:MI') AS time, to_char(a.appointment_at, 'AM') AS meridiem,
               a.service_type, a.status, a.metadata,
               u.display_name AS patient_name, u.phone AS patient_phone, u.profile AS patient_profile
        FROM appointments a
        LEFT JOIN users u ON u.id = a.patient_id
        WHERE a.doctor_id = $1 AND a.appointment_at::date = current_date
        ORDER BY a.appointment_at ASC
      `,
      [doctor.id],
    );
    const notifications = await pool.query('SELECT title, body, category, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [doctor.id]);
    const stats = statsResult.rows[0];
    const todaysAppointments = Number(stats.todays_appointments || 0);
    const consultationsDone = Number(stats.consultations_done || 0);
    res.json({
      doctor: { displayName: doctor.display_name, title: `${doctor.profile?.specialization || 'Gynecology'} Specialist`, profile: doctor.profile || {} },
      stats: {
        totalAppointments: Number(stats.total_appointments || 0),
        pendingAppointments: Number(stats.pending_appointments || 0),
        missedAppointments: Number(stats.missed_appointments || 0),
        todaysAppointments,
        pendingPrescriptions: Number(prescriptionResult.rows[0].pending_prescriptions || 0),
        consultationsDone,
        capacityText: todaysAppointments ? `${Math.min(100, Math.round((todaysAppointments / 14) * 100))}% capacity filled` : 'No appointments today',
        completionText: todaysAppointments ? `${Math.round((consultationsDone / todaysAppointments) * 100)}% of daily goal` : 'Ready for first consultation',
      },
      schedule: scheduleResult.rows.map((item, index) => ({
        id: item.id,
        time: item.time,
        meridiem: item.meridiem,
        label: item.status === 'IN_PROGRESS' ? 'Ongoing Consultation' : index === 0 ? 'Next Visit' : 'Follow-up',
        patientName: item.patient_name || 'Patient',
        serviceType: item.patient_profile?.currentConcern || item.service_type,
        status: item.status,
        virtualMeeting: item.metadata?.virtualMeeting || null,
        patientWhatsApp: item.patient_profile?.whatsappNumber || item.patient_phone || null,
      })),
      notifications: notifications.rows,
      storage: 'postgres',
    });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/schedule', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const { start, end } = monthBounds(req.query.month);
    const dailyDate = String(req.query.date || new Date().toISOString().slice(0, 10));
    const appointments = await pool.query(
      `
        SELECT a.id, a.appointment_at, to_char(a.appointment_at, 'HH12:MI AM') AS time_label,
               a.service_type, a.status, a.metadata,
               u.display_name AS patient_name, u.phone AS patient_phone, u.profile AS patient_profile
        FROM appointments a
        LEFT JOIN users u ON u.id = a.patient_id
        WHERE a.doctor_id = $1 AND a.appointment_at >= $2::date AND a.appointment_at < $3::date
        ORDER BY a.appointment_at ASC
      `,
      [doctor.id, start, end],
    );
    const availability = await pool.query(
      'SELECT available_date::text AS date, is_available, slots, notes FROM doctor_availability WHERE doctor_id = $1 AND available_date >= $2::date AND available_date < $3::date ORDER BY available_date ASC',
      [doctor.id, start, end],
    );
    res.json({
      doctor: { id: doctor.id, displayName: doctor.display_name, title: `${doctor.profile?.specialization || 'Gynecology'} Specialist` },
      defaultSlots: DEFAULT_SLOTS,
      availability: availability.rows,
      daily: appointments.rows.filter((item) => item.appointment_at.toISOString().slice(0, 10) === dailyDate).map((item) => ({
        id: item.id,
        time: item.time_label,
        patientName: item.patient_name || 'Patient',
        phone: item.patient_phone,
        serviceType: item.patient_profile?.currentConcern || item.service_type,
        status: item.status,
        virtualMeeting: item.metadata?.virtualMeeting || null,
      })),
      monthly: appointments.rows.map((item) => ({
        id: item.id,
        date: item.appointment_at.toISOString().slice(0, 10),
        time: item.time_label,
        patientName: item.patient_name || 'Patient',
        serviceType: item.service_type,
        status: item.status,
        virtualMeeting: item.metadata?.virtualMeeting || null,
      })),
      storage: 'postgres',
    });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.post('/availability', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const date = String(req.body.date || '').trim();
    const isAvailable = !(req.body.isAvailable === false || req.body.isAvailable === 'false' || req.body.isAvailable === '0');
    const slots = Array.isArray(req.body.slots) ? req.body.slots.map((slot) => String(slot).trim()).filter(Boolean) : [];
    const slotRanges = Array.isArray(req.body.slotRanges) ? req.body.slotRanges : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'A valid date is required.' });
    const validation = validateAvailabilitySlots(slots, slotRanges);
    if (isAvailable && !validation.ok) return res.status(400).json({ message: validation.message });
    const selectedSlots = selectedAvailabilitySlots(slots, validation.slots || []);
    const saved = await pool.query(
      `
        INSERT INTO doctor_availability (doctor_id, available_date, is_available, slots, notes)
        VALUES ($1, $2::date, $3, $4::text[], $5::jsonb)
        ON CONFLICT (doctor_id, available_date)
        DO UPDATE SET is_available = EXCLUDED.is_available, slots = EXCLUDED.slots, notes = EXCLUDED.notes, updated_at = now()
        RETURNING available_date::text AS date, is_available, slots, notes
      `,
      [doctor.id, date, isAvailable, isAvailable ? selectedSlots : [], JSON.stringify({ source: 'doctor_schedule', slotDurationMinutes: SLOT_DURATION_MINUTES, slotRanges: validation.ranges || [], unavailableSlots: isAvailable ? (validation.ranges || []).filter((range) => !selectedSlots.includes(range.start)) : validation.ranges || [] })],
    );
    res.json({ availability: saved.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/appointments/:id/status', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const status = String(req.body.status || '').trim().toUpperCase();
    if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) return res.status(400).json({ message: 'Unsupported appointment status.' });
    const result = await pool.query('UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 AND doctor_id = $3 RETURNING id, status', [status, req.params.id, doctor.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Appointment not found.' });
    res.json({ appointment: result.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/appointment-context', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const appointmentId = String(req.query.appointmentId || '').trim();
    const appointmentResult = await pool.query(
      `
        SELECT a.*, p.display_name AS patient_name, p.phone, p.email, p.profile
        FROM appointments a
        JOIN users p ON p.id = a.patient_id
        WHERE a.doctor_id = $1 AND ($2::uuid IS NULL OR a.id = $2::uuid) AND a.status <> 'CANCELLED'
        ORDER BY CASE WHEN a.status = 'IN_PROGRESS' THEN 0 ELSE 1 END, ABS(EXTRACT(EPOCH FROM (a.appointment_at - now()))) ASC
        LIMIT 1
      `,
      [doctor.id, appointmentId || null],
    );
    if (!appointmentResult.rowCount) return res.status(404).json({ message: 'No appointment found.' });
    const appointment = appointmentResult.rows[0];
    const [documents, prescriptions] = await Promise.all([
      pool.query(
        'SELECT id, document_type, name, document_date::text AS document_date, file_name, file_path, status, metadata, created_at FROM medical_documents WHERE patient_id = $1 ORDER BY COALESCE(document_date, created_at::date) DESC, created_at DESC',
        [appointment.patient_id],
      ),
      pool.query('SELECT id, status, medications, instructions, metadata, created_at FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [appointment.patient_id]),
    ]);
    res.json({
      appointment: {
        id: appointment.id,
        appointmentAt: appointment.appointment_at,
        serviceType: appointment.service_type,
        status: appointment.status,
        notes: appointment.notes || {},
        metadata: appointment.metadata || {},
        virtualMeeting: appointment.metadata?.virtualMeeting || null,
      },
      patient: {
        id: appointment.patient_id,
        name: appointment.patient_name,
        phone: appointment.phone,
        email: appointment.email,
        profile: appointment.profile || {},
        whatsappNumber: appointment.profile?.whatsappNumber || appointment.phone,
      },
      documents: documents.rows,
      prescriptions: prescriptions.rows,
    });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.patch('/appointments/:id/notes', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const observations = String(req.body.observations || '').trim();
    const recommendedActions = Array.isArray(req.body.recommendedActions) ? req.body.recommendedActions.map((item) => String(item).trim()).filter(Boolean) : [];
    const status = String(req.body.status || '').trim().toUpperCase();
    if (status && !['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) return res.status(400).json({ message: 'Unsupported appointment status.' });
    const notesPatch = {
      observations,
      recommendedActions,
      updatedBy: 'doctor',
      updatedAt: new Date().toISOString(),
    };
    if (status === 'COMPLETED') notesPatch.completedAt = notesPatch.updatedAt;
    const result = await pool.query(
      `
        UPDATE appointments
        SET notes = notes || $1::jsonb,
            status = CASE
              WHEN status = 'COMPLETED' AND $2 = 'IN_PROGRESS' THEN status
              ELSE COALESCE(NULLIF($2, ''), status)
            END,
            updated_at = now()
        WHERE id = $3 AND doctor_id = $4
        RETURNING id, notes, status
      `,
      [JSON.stringify(notesPatch), status, req.params.id, doctor.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Appointment not found.' });
    res.json({ appointment: result.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/documents/:id/download', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const result = await pool.query(
      `
        SELECT md.file_path, md.file_name, md.mime_type, md.metadata
        FROM medical_documents md
        WHERE md.id = $1 AND EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = md.patient_id AND a.doctor_id = $2)
        LIMIT 1
      `,
      [req.params.id, doctor.id],
    );
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

router.get('/documents/:id/view', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const result = await pool.query(
      `
        SELECT md.file_path, md.file_name, md.mime_type, md.metadata
        FROM medical_documents md
        WHERE md.id = $1 AND EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = md.patient_id AND a.doctor_id = $2)
        LIMIT 1
      `,
      [req.params.id, doctor.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Document file not found.' });
    const document = result.rows[0];
    const dbFile = document.metadata?.file;
    const fileName = dbFile?.originalName || document.file_name || 'medical-document';
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    if (dbFile?.base64) {
      const buffer = Buffer.from(dbFile.base64, 'base64');
      res.type(dbFile.mimeType || document.mime_type || 'application/octet-stream');
      return res.send(buffer);
    }
    if (!document.file_path) return res.status(404).json({ message: 'Document file not found.' });
    const filename = path.basename(document.file_path);
    const absolutePath = path.resolve(uploadDir, filename);
    const safeUploadDir = path.resolve(uploadDir);
    if (!absolutePath.startsWith(safeUploadDir) || !fs.existsSync(absolutePath)) return res.status(404).json({ message: 'Document file not found.' });
    res.type(document.mime_type || 'application/octet-stream');
    return res.sendFile(absolutePath);
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.post('/appointments/:id/prescription-photo', prescriptionPhotoUpload.single('file'), async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    if (!req.file) return res.status(400).json({ message: 'Choose a prescription photo to upload.' });

    const appointment = await pool.query('SELECT id, patient_id FROM appointments WHERE id = $1 AND doctor_id = $2 LIMIT 1', [req.params.id, doctor.id]);
    if (!appointment.rowCount) return res.status(404).json({ message: 'Appointment not found.' });

    const name = String(req.body.name || '').trim() || 'Written Prescription Photo';
    const fileMetadata = {
      storage: 'database_base64',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      base64: req.file.buffer.toString('base64'),
    };
    const saved = await pool.query(
      `
        INSERT INTO medical_documents (patient_id, appointment_id, uploaded_by, document_type, name, document_date, file_name, file_path, mime_type, metadata)
        VALUES ($1, $2, $3, 'OLD_PRESCRIPTION', $4, COALESCE(NULLIF($5, '')::date, current_date), $6, NULL, $7, $8::jsonb)
        RETURNING id, appointment_id, document_type, name, document_date::text AS document_date, file_name, status, metadata, created_at
      `,
      [
        appointment.rows[0].patient_id,
        appointment.rows[0].id,
        doctor.id,
        name,
        String(req.body.documentDate || '').trim(),
        req.file.originalname,
        req.file.mimetype,
        JSON.stringify({ uploadedDuring: 'doctor_prescription_builder', appointmentId: appointment.rows[0].id, file: fileMetadata }),
      ],
    );
    res.status(201).json({ document: saved.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

router.post('/prescriptions', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const appointment = await pool.query(
      `
        SELECT a.id, a.patient_id, a.appointment_at, a.service_type, a.status, a.notes, a.metadata AS appointment_metadata,
               p.display_name AS patient_name, p.phone AS patient_phone, p.email AS patient_email, p.profile AS patient_profile
        FROM appointments a
        LEFT JOIN users p ON p.id = a.patient_id
        WHERE a.id = $1 AND a.doctor_id = $2
        LIMIT 1
      `,
      [String(req.body.appointmentId || '').trim(), doctor.id],
    );
    if (!appointment.rowCount) return res.status(404).json({ message: 'Appointment not found.' });
    const appointmentRow = appointment.rows[0];
    const medications = Array.isArray(req.body.medications) ? req.body.medications : [];
    const prescriptionStatus = String(req.body.status || 'FINAL').trim().toUpperCase();
    if (!['DRAFT', 'FINAL'].includes(prescriptionStatus)) return res.status(400).json({ message: 'Unsupported prescription status.' });
    const instructions = { advice: String(req.body.advice || '').trim(), followUpDate: String(req.body.followUpDate || '').trim() || null };
    const metadata = {
      source: 'appointment_details',
      savedAt: new Date().toISOString(),
      saveMode: prescriptionStatus.toLowerCase(),
      medicationCount: medications.length,
      appointment: {
        id: appointmentRow.id,
        appointmentAt: appointmentRow.appointment_at,
        serviceType: appointmentRow.service_type,
        status: appointmentRow.status,
        notes: appointmentRow.notes || {},
        metadata: appointmentRow.appointment_metadata || {},
      },
      patient: {
        id: appointmentRow.patient_id,
        name: appointmentRow.patient_name,
        phone: appointmentRow.patient_phone,
        email: appointmentRow.patient_email,
        profile: appointmentRow.patient_profile || {},
      },
      doctor: {
        id: doctor.id,
        name: doctor.display_name,
        email: doctor.email,
        profile: doctor.profile || {},
      },
    };
    const saved = await pool.query(
      'INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, status, medications, instructions, metadata) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb) RETURNING id, appointment_id, doctor_id, patient_id, status, medications, instructions, metadata, created_at',
      [appointmentRow.id, doctor.id, appointmentRow.patient_id, prescriptionStatus, JSON.stringify(medications), JSON.stringify(instructions), JSON.stringify(metadata)],
    );
    res.status(201).json({ prescription: saved.rows[0] });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/patients/lists', async (req, res, next) => {
  try {
    const doctor = await currentDoctor(req);
    if (!doctor) return res.status(404).json({ message: 'Doctor record not found in database.' });
    const rows = await pool.query(
      `
        SELECT a.id AS appointment_id, a.appointment_at, a.appointment_at::date::text AS appointment_date, to_char(a.appointment_at, 'HH12:MI AM') AS time_label,
               a.service_type, a.status,
               p.id AS patient_id, p.display_name AS patient_name, p.phone, p.email, p.profile
        FROM appointments a
        JOIN users p ON p.id = a.patient_id
        WHERE a.doctor_id = $1 AND a.status <> 'CANCELLED' AND a.appointment_at >= current_date
        ORDER BY a.appointment_at ASC
      `,
      [doctor.id],
    );
    const today = new Date().toISOString().slice(0, 10);
    const list = rows.rows.map((item) => ({
      appointmentId: item.appointment_id,
      appointmentAt: item.appointment_at,
      date: item.appointment_date,
      time: item.time_label,
      serviceType: item.profile?.currentConcern || item.service_type,
      status: item.status,
      patient: {
        id: item.patient_id,
        name: item.patient_name,
        phone: item.phone,
        email: item.email,
        profile: item.profile || {},
      },
    }));
    res.json({
      current: list.filter((item) => item.date === today),
      future: list.filter((item) => item.date > today),
    });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

router.get('/patients/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ patients: [] });
    const result = await pool.query(
      `
        SELECT id, display_name, phone, email, profile
        FROM users
        WHERE role = 'PATIENT' AND (display_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)
        ORDER BY display_name ASC
        LIMIT 10
      `,
      [`%${q}%`],
    );
    res.json({ patients: result.rows.map((patient) => ({ id: patient.id, name: patient.display_name, phone: patient.phone, email: patient.email, concern: patient.profile?.currentConcern || 'Not recorded', profile: patient.profile || {} })) });
  } catch (error) {
    if (isDbUnavailable(error)) return res.status(503).json({ message: 'PostgreSQL is not connected.', detail: error.code });
    next(error);
  }
});

module.exports = { doctorRouter: router };
