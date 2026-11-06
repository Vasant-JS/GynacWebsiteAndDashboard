const { pool } = require('./db');
const { syncConsultationMeeting } = require('./meeting');

async function changeAppointment(id, role, userId, { status, prepareTime } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const column = role === 'DOCTOR' ? 'doctor_id' : 'patient_id';
    const result = await client.query(`SELECT * FROM appointments WHERE id=$1 AND ${column}=$2 FOR UPDATE`, [id,userId]);
    const appointment = result.rows[0];
    if (!appointment) throw Object.assign(new Error('Appointment not found.'),{status:404});
    if (['CANCELLED','COMPLETED'].includes(appointment.status) && (prepareTime || status !== appointment.status)) throw Object.assign(new Error('Closed appointments cannot be changed.'),{status:409});
    let appointmentAt = appointment.appointment_at;
    if (prepareTime) {
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[appointment.doctor_id]);
      appointmentAt = await prepareTime(appointment,client);
    }
    let meeting = appointment.metadata?.virtualMeeting;
    if (prepareTime || (status === 'CANCELLED' && appointment.status !== 'CANCELLED')) {
      try { meeting = await syncConsultationMeeting(appointment,{cancel:status==='CANCELLED',appointmentAt}); }
      catch (error) { throw Object.assign(new Error('Google Calendar could not synchronize this change. Your appointment has not changed. Try again or contact the hospital.'),{status:502,publicMessage:'Google Calendar could not synchronize this change. Your appointment has not changed. Try again or contact the hospital.'}); }
    }
    const metadata = { ...(meeting ? {virtualMeeting:meeting} : {}), ...(prepareTime ? {rescheduledBy:role.toLowerCase(),rescheduledAt:new Date().toISOString()} : {}) };
    const updated = await client.query('UPDATE appointments SET status=$1, appointment_at=$2, metadata=metadata || $3::jsonb, updated_at=now() WHERE id=$4 RETURNING *', [status || appointment.status,appointmentAt,JSON.stringify(metadata),id]);
    await client.query('COMMIT'); return updated.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { changeAppointment };
