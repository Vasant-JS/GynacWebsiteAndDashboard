require('dotenv').config({quiet:true});
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),{randomUUID}=require('node:crypto');
const {pool}=require('../server/db'),{requireRole}=require('../server/access'),{ensureAttendanceSchema}=require('../server/attendance');
require('../server/meeting').createConsultationMeeting=async()=>({provider:'test',mode:'not_configured',meetLink:null});
require('../server/meeting').syncConsultationMeeting=async appointment=>appointment.metadata?.virtualMeeting;
const {patientRouter}=require('../server/patient'),{doctorRouter}=require('../server/doctor'),{caseHistoryRouter,ensureCaseHistorySchema}=require('../server/case-history'),{adminRouter}=require('../server/admin');
test('hospital booking without doctor, shared queue, concurrent attendance, clinical ownership and admin counts',async()=>{
 await ensureAttendanceSchema();await ensureCaseHistorySchema();
 const ids={A:randomUUID(),B:randomUUID(),P:randomUUID(),Q:randomUUID(),ADMIN:randomUUID()},sessions={},created=[];let server;
 try{
  await pool.query(`INSERT INTO users(id,role,display_name,metadata) VALUES($1,'DOCTOR','Queue Test Doctor A','{"test":true}'),($2,'DOCTOR','Queue Test Doctor B','{"test":true}'),($3,'PATIENT','Queue Test Patient P','{"test":true}'),($4,'PATIENT','Queue Test Patient Q','{"test":true}'),($5,'ADMIN','Queue Test Admin','{"test":true}')`,Object.values(ids));
  await pool.query("INSERT INTO doctor_availability(doctor_id,available_date,is_available,slots) VALUES($1,'2031-03-12',false,'{}'),($2,'2031-03-12',false,'{}')",[ids.A,ids.B]);
  const app=express();app.use(express.json());app.use((req,res,next)=>{const key=req.headers['x-test-user'];req.session=sessions[key || 'none'] ||= {};if(ids[key]){const role=['A','B'].includes(key)?'DOCTOR':key==='ADMIN'?'ADMIN':'PATIENT';req.session.user={id:ids[key],role};req.session[role==='DOCTOR'?'doctorUser':role==='ADMIN'?'adminUser':'patientUser']=req.session.user;req.session.doctorLastSeen=Date.now();}next();});app.use('/api/patient',requireRole('PATIENT'),patientRouter);app.use('/api/doctor',requireRole('DOCTOR'),caseHistoryRouter,doctorRouter);app.use('/api/admin',requireRole('ADMIN'),adminRouter);app.use((err,req,res,next)=>res.status(err.status||500).json({message:err.message}));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
  async function request(path,user='A',method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{'x-test-user':user}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
  assert.equal((await request('/api/doctor/appointments-directory',null)).status,401);
  for(const patient of ['P','Q']){
   const reason=await request('/api/patient/booking/reason',patient,'POST',{service:'Gynecology',reason:'Shared queue booking',doctorId:ids.A});assert.equal(reason.status,200);assert.equal(reason.data.booking.doctorId,null);
   const availability=await request('/api/patient/booking/availability?doctorId='+ids.A,patient);assert(availability.data.defaultSlots.includes('09:00 AM'));assert.deepEqual(availability.data.booked,[]);
   const booking=await request('/api/patient/booking/confirm',patient,'POST',{date:'2031-03-12',time:'09:00 AM',medicalConsent:true,accuracyConsent:true,declarationName:'Queue Test Patient '+patient});assert.equal(booking.status,201,JSON.stringify(booking.data));created.push(booking.data.appointment.id);assert.equal(booking.data.appointment.doctor_id,null);assert.equal(booking.data.appointment.attended_by,null);
  }
  for(const doctor of ['A','B']){const queue=await request('/api/doctor/appointments-directory?scope=upcoming&search=Queue%20Test%20Patient',doctor);assert.equal(queue.status,200,JSON.stringify(queue.data));assert.equal(queue.data.total,2);assert(queue.data.appointments.every(a=>a.canAttend&&a.doctor.id===null));const lists=await request('/api/doctor/patients/lists',doctor);assert.equal(lists.status,200);assert(lists.data.future.some(a=>a.appointmentId===created[0]));}
  const history='/api/doctor/appointments/'+created[0]+'/case-history';assert.equal((await request(history)).data.canEdit,false);
  assert.equal((await request(history,'A','PUT',{version:0,data:{complaint:'Not allowed before attendance'}})).status,404);
  const outcomes=await Promise.all(['A','B'].map(user=>request('/api/doctor/appointments/'+created[0]+'/attend',user,'POST')));assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);const winner=outcomes[0].status===200?'A':'B',loser=winner==='A'?'B':'A';
  const saved=(await pool.query('SELECT * FROM appointments WHERE id=$1',[created[0]])).rows[0];assert.equal(saved.attended_by,ids[winner]);assert.equal(saved.doctor_id,ids[winner]);assert(saved.attended_at);assert.equal(saved.status,'IN_PROGRESS');
  const repeated=await request('/api/doctor/appointments/'+created[0]+'/attend',winner,'POST');assert.equal(new Date(repeated.data.appointment.attended_at).toISOString(),saved.attended_at.toISOString());
  assert.equal((await request(history,winner)).data.canEdit,true);assert.equal((await request(history,loser)).data.canEdit,false);
  assert.equal((await request(history,winner,'PUT',{version:0,data:{complaint:'Recorded by attending doctor'}})).status,200);assert.equal((await request(history,loser,'PUT',{version:1,data:{complaint:'Unauthorized'}})).status,404);
  assert.equal((await request('/api/doctor/appointments/'+created[0]+'/notes',loser,'PATCH',{observations:'Unauthorized'})).status,404);
  assert.equal((await request('/api/doctor/prescriptions',winner,'POST',{appointmentId:created[0],status:'FINAL',medications:[{name:'Queue test medication'}]})).status,201);
  assert.equal((await request('/api/doctor/appointments/'+created[0]+'/status',winner,'PATCH',{status:'COMPLETED'})).status,200);
  const patientList=await request('/api/patient/appointments','P');assert.equal(patientList.data.appointments.find(a=>a.id===created[0]).doctor_name,'Queue Test Doctor '+winner);
  const admin=await request('/api/admin/doctors','ADMIN');const doc=admin.data.doctors.find(d=>d.id===ids[winner]);assert.equal(Number(doc.attended_count),1);assert.equal(Number(doc.completed_count),1);
  const dashboard=await request('/api/doctor/dashboard',loser);assert.equal(dashboard.status,200,JSON.stringify(dashboard.data));
  const notifications=await pool.query("SELECT user_id FROM notifications WHERE metadata->>'appointmentId'=$1 AND title='New hospital consultation'",[created[1]]);assert(notifications.rows.some(n=>n.user_id===ids.A));assert(notifications.rows.some(n=>n.user_id===ids.B));
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await pool.query("DELETE FROM notifications WHERE metadata->>'appointmentId' IN (SELECT id::text FROM appointments WHERE patient_id=ANY($1::uuid[]))",[[ids.P,ids.Q]]);
    await pool.query('DELETE FROM prescriptions WHERE patient_id=ANY($1::uuid[])',[[ids.P,ids.Q]]);await pool.query('DELETE FROM appointments WHERE patient_id=ANY($1::uuid[])',[[ids.P,ids.Q]]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[Object.values(ids)]);await pool.end();}
});
