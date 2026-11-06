const express = require('express');
const { pool } = require('./db');
const { refreshConsultationMeeting, safeMeetLink } = require('./meeting');
const router = express.Router();
router.get('/:id/join', async (req,res,next) => {
  res.set('Cache-Control','no-store');
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).send('Consultation not found.');
    const role = String(req.query.role || req.authUser.role).toUpperCase();
    if (!['DOCTOR','PATIENT'].includes(role)) return res.status(400).send('Invalid consultation role.');
    const user = role === req.authUser.role ? req.authUser : req.session[role === 'DOCTOR' ? 'doctorUser' : 'patientUser'];
    if (!user || user.role !== role) return res.status(401).send('Please sign in to your consultation account.');
    const column = role === 'DOCTOR' ? 'doctor_id' : 'patient_id';
    const result = await pool.query(`SELECT * FROM appointments WHERE id=$1 AND ${column}=$2`,[req.params.id,user.id]);
    const appointment = result.rows[0];
    if (!appointment) return res.status(404).send('Consultation not found.');
    if (['COMPLETED','CANCELLED'].includes(appointment.status)) return res.status(409).send('Google Meet is unavailable for completed or cancelled consultations.');
    let meeting = appointment.metadata?.virtualMeeting;
    if (!meeting?.meetLink && meeting?.calendarEventId) {
      meeting = await refreshConsultationMeeting(meeting);
      await pool.query("UPDATE appointments SET metadata=jsonb_set(metadata,'{virtualMeeting}',$1::jsonb) WHERE id=$2",[JSON.stringify(meeting),appointment.id]);
    }
    const link = safeMeetLink(meeting?.meetLink);
    if (!link) return res.status(503).send('Your Google Meet link is not ready. Try again shortly or contact the hospital at +91 86188 18012.');
    return res.redirect(link);
  } catch (error) { next(error); }
});
module.exports = { meetingRouter:router };
