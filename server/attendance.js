const {isPastAppointmentDate}=require('./appointment-date');
const {pool}=require('./db');
async function ensureAttendanceSchema(){
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS attended_by uuid REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS attended_at timestamptz;
    UPDATE appointments SET attended_by=doctor_id,attended_at=COALESCE(updated_at,appointment_at),metadata=metadata||'{"attendanceSource":"legacy_status"}'::jsonb
      WHERE attended_by IS NULL AND doctor_id IS NOT NULL AND status IN ('IN_PROGRESS','COMPLETED');
    CREATE INDEX IF NOT EXISTS idx_appointments_attended_by ON appointments(attended_by,attended_at);`);
}
async function attendAppointment(id,doctorId){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const doctor=await client.query("SELECT id FROM users WHERE id=$1 AND role='DOCTOR' AND status='ACTIVE'",[doctorId]);
    if(!doctor.rowCount)throw Object.assign(new Error('Active doctor login required.'),{status:401});
    const result=await client.query('SELECT * FROM appointments WHERE id=$1 FOR UPDATE',[id]);
    const appointment=result.rows[0];if(!appointment)throw Object.assign(new Error('Appointment not found.'),{status:404});
    if(isPastAppointmentDate(appointment.appointment_at))throw Object.assign(new Error('Past appointments cannot be attended.'),{status:409});
    if(appointment.attended_by && appointment.attended_by!==doctorId)throw Object.assign(new Error('Another doctor is attending this appointment. Refresh the queue.'),{status:409});
    if(['COMPLETED','CANCELLED'].includes(appointment.status))throw Object.assign(new Error('Closed appointments cannot be attended.'),{status:409});
    if(appointment.attended_by===doctorId){await client.query('COMMIT');return appointment;}
    const saved=await client.query("UPDATE appointments SET attended_by=$1,attended_at=now(),doctor_id=$1,status='IN_PROGRESS',metadata=metadata||jsonb_build_object('legacyBookedDoctorId',doctor_id,'attendanceSource','explicit_attend'),updated_at=now() WHERE id=$2 RETURNING *",[doctorId,id]);
    await client.query('COMMIT');return saved.rows[0];
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function notifyBooking(client,patientId,appointmentId,body){
  const patient=(await client.query('SELECT metadata FROM users WHERE id=$1',[patientId])).rows[0];
  const isTest=patient?.metadata?.test===true;
  const metadata=JSON.stringify({appointmentId,...(isTest?{test:true}:{})});
  await client.query("INSERT INTO notifications(user_id,title,body,category,metadata) VALUES($1,'Appointment booked',$2,'APPOINTMENT',$3::jsonb)",[patientId,body,metadata]);
  await client.query("INSERT INTO notifications(user_id,title,body,category,metadata) SELECT id,'New hospital consultation',$1,'APPOINTMENT',$2::jsonb FROM users WHERE role='DOCTOR' AND status='ACTIVE' AND COALESCE(metadata->>'test','false')=$3",[body,metadata,isTest?'true':'false']);
}
module.exports={ensureAttendanceSchema,attendAppointment,notifyBooking};
