const express = require('express');
const { pool } = require('./db');
const hospital = require('../assets/hospital.json');
const { requireRole } = require('./access');
const router = express.Router();
router.get('/consultation-times',(req,res)=>{
  const Clinical=require('../assets/js/clinical-schema'),date=String(req.query.date || Clinical.today());
  if(!Clinical.dateValue(date))return res.status(400).json({message:'Choose a valid date.'});
  const slots=require('./patient').defaultSlots.filter(slot=>{
    const [time,meridiem]=slot.split(' '),[hour,minute]=time.split(':').map(Number),h=(hour%12)+(meridiem==='PM'?12:0);
    return new Date(date+'T'+String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00+05:30')>new Date();
  });
  res.json({date,slots,bookingMode:'HOSPITAL_QUEUE'});
});

async function ensurePublicSchema(client = pool) {
  await client.query(`CREATE TABLE IF NOT EXISTS contact_enquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
    email text NOT NULL, subject text NOT NULL, message text NOT NULL,
    status text NOT NULL DEFAULT 'NEW', created_at timestamptz NOT NULL DEFAULT now())`);
}
router.get('/hospital', (_req, res) => res.json(hospital));
router.get('/doctors', async (_req, res, next) => {
  try {
    const doctors = await pool.query("SELECT id, display_name, profile, metadata->>'rosterKey' AS key FROM users WHERE role = 'DOCTOR' AND status = 'ACTIVE' AND COALESCE(metadata->>'test', 'false') <> 'true' ORDER BY display_name");
    res.json({ doctors: doctors.rows.map(doctor => ({
      id: doctor.id, key: doctor.key || doctor.id, name: doctor.display_name,
      qualifications: doctor.profile?.qualifications || '',
      specialization: doctor.profile?.specialization || 'Gynecology',
      title: doctor.profile?.title || '', photoUrl: doctor.profile?.photoUrl || '/assets/images/sumohan-care-logo.png',
      experienceYears: doctor.profile?.experienceYears ?? null,
      consultationFee: doctor.profile?.consultationFee ?? null,
      languages: Array.isArray(doctor.profile?.languages) ? doctor.profile.languages : [],
    })) });
  } catch (error) { next(error); }
});
router.get('/doctors/:id/availability', async (req, res, next) => {
  const date = String(req.query.date || '');
  const Clinical = require('../assets/js/clinical-schema');
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !Clinical.dateValue(date)) return res.status(400).json({ message: 'Choose a valid doctor and date.' });
  if (date < Clinical.today()) return res.status(400).json({ message: 'Choose today or a future date.' });
  try {
    const doctor = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'DOCTOR' AND status = 'ACTIVE'", [req.params.id]);
    if (!doctor.rowCount) return res.status(404).json({ message: 'Doctor not found.' });
    const [availability, booked] = await Promise.all([
      pool.query('SELECT is_available, slots FROM doctor_availability WHERE doctor_id = $1 AND available_date = $2::date', [req.params.id, date]),
      pool.query("SELECT to_char(appointment_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS slot FROM appointments WHERE doctor_id = $1 AND (appointment_at AT TIME ZONE 'Asia/Kolkata')::date = $2::date AND status <> 'CANCELLED'", [req.params.id, date]),
    ]);
    const defaultSlots = [];
    for (const [start, end] of [[9 * 60, 12 * 60], [13 * 60, 17 * 60], [18 * 60, 20 * 60]]) {
      for (let minute = start; minute <= end; minute += 15) {
        const hour = Math.floor(minute / 60);
        defaultSlots.push(`${String(hour % 12 || 12).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`);
      }
    }
    const rule = availability.rows[0];
    const unavailable = new Set(booked.rows.map(row => row.slot));
    const slots = (rule ? (rule.is_available ? rule.slots : []) : defaultSlots).filter(slot => {
      const [hours, minutes, meridiem] = slot.match(/(\d+):(\d+) (AM|PM)/)?.slice(1) || [];
      if (!hours) return false;
      const hour = Number(hours) % 12 + (meridiem === 'PM' ? 12 : 0);
      const at = new Date(`${date}T${String(hour).padStart(2, '0')}:${minutes}:00+05:30`);
      return !unavailable.has(slot) && at > new Date();
    });
    res.json({ date, slots });
  } catch (error) { next(error); }
});
router.post('/contact', async (req, res, next) => {
  const { name, email, subject, message } = req.body;
  if (![name, email, subject, message].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ message: 'Complete all enquiry fields.' });
  if (name.length > 100 || subject.length > 200 || message.length > 4000 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter valid enquiry details.' });
  const now = Date.now();
  const recent = (req.session.enquiryTimes || []).filter(time => now - time < 600000);
  if (recent.length >= 3) return res.status(429).json({ message: 'Please wait before submitting another enquiry.' });
  try {
    const result = await pool.query('INSERT INTO contact_enquiries (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id', [name.trim(), email.trim().toLowerCase(), subject.trim(), message.trim()]);
    req.session.enquiryTimes = [...recent, now];
    res.status(201).json({ message: 'Your enquiry has been saved for the hospital team.', reference: result.rows[0].id });
  } catch (error) { next(error); }
});
router.get('/enquiries', requireRole('ADMIN'), async (_req, res, next) => {
  try { res.json({ enquiries: (await pool.query('SELECT * FROM contact_enquiries ORDER BY created_at DESC LIMIT 200')).rows }); }
  catch (error) { next(error); }
});
router.patch('/enquiries/:id', requireRole('ADMIN'), async (req, res, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !['NEW', 'IN_PROGRESS', 'CLOSED'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid enquiry update.' });
  try {
    const result = await pool.query('UPDATE contact_enquiries SET status = $1 WHERE id = $2 RETURNING id', [req.body.status, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Enquiry not found.' });
    res.json({ message: 'Enquiry updated.' });
  } catch (error) { next(error); }
});
module.exports = { publicRouter: router, ensurePublicSchema };
