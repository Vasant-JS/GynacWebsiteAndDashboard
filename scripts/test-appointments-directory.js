require('dotenv').config({quiet:true});
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),{randomUUID}=require('node:crypto');
const {pool}=require('../server/db'),{requireRole}=require('../server/access'),{doctorRouter}=require('../server/doctor');

test('appointment directory includes all dates and doctors, preserves clinical ownership, and uses IST day boundaries',async()=>{
 const doctor=randomUUID(),other=randomUUID(),patient=randomUUID(),appointments=Array.from({length:5},()=>randomUUID());let server;
 try{
  await require('../server/attendance').ensureAttendanceSchema();
  await pool.query(`INSERT INTO users(id,role,display_name,profile,metadata) VALUES($1,'DOCTOR','Directory Test Doctor','{}','{"test":true}'),($2,'DOCTOR','Directory Other Doctor','{}','{"test":true}'),($3,'PATIENT','Directory Test Patient','{"age":30,"gender":"Female","privateField":"must-not-leak"}','{"test":true}')`,[doctor,other,patient]);
  const today="((now() AT TIME ZONE 'Asia/Kolkata')::date + time '00:15') AT TIME ZONE 'Asia/Kolkata'";
  await pool.query(`INSERT INTO appointments(id,doctor_id,patient_id,appointment_at,service_type,status,notes,metadata) VALUES
   ($1,$6,$8,${today},'Directory midnight','SCHEDULED','{"reason":"Own recorded reason"}','{"consultationType":"FOLLOW_UP"}'),
   ($2,$6,$8,now()+interval '400 days','Directory future','SCHEDULED','{}','{}'),
   ($3,$7,$8,now()+interval '500 days','Directory other','SCHEDULED','{"reason":"Other private reason"}','{"virtualMeeting":{"meetLink":"https://meet.google.com/private"}}'),
   ($4,$7,$8,now()-interval '5 days','Directory past','COMPLETED','{}','{}'),
   ($5,$6,$8,now()-interval '4 days','Directory cancelled','CANCELLED','{}','{}')`,[...appointments,doctor,other,patient]);
  await pool.query('UPDATE appointments SET attended_by=doctor_id,attended_at=now() WHERE id=ANY($1::uuid[])',[[appointments[0],appointments[2],appointments[3]]]);
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={};if(req.headers['x-test-role']){req.session.user={id:req.headers['x-test-role']==='OTHER'?other:doctor,role:req.headers['x-test-role']==='PATIENT'?'PATIENT':'DOCTOR'};req.session.doctorLastSeen=Date.now();}next();});app.use('/api/doctor',requireRole('DOCTOR'),doctorRouter);app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port;
  async function get(query='',role='DOCTOR'){const r=await fetch(base+'/api/doctor/appointments-directory'+query,{headers:role?{'x-test-role':role}:{}});return {status:r.status,data:await r.json()};}
  assert.equal((await get('',null)).status,401);assert.equal((await get('','PATIENT')).status,401);
  const mine=await get();assert.equal(mine.status,200,JSON.stringify(mine.data));assert(mine.data.appointments.some(a=>a.id===appointments[0]));assert(mine.data.appointments.some(a=>a.id===appointments[1]));assert(mine.data.appointments.some(a=>a.id===appointments[2]&&!a.isMine));assert.equal(mine.data.appointments.find(a=>a.id===appointments[0]).reason,'Own recorded reason');
  const all=await get('?scope=all&search=Directory%20Test%20Patient');assert.equal(all.data.total,3);assert.equal(all.data.counts.upcoming,3);assert.equal(all.data.counts.past,2);
  const foreign=all.data.appointments.find(a=>a.id===appointments[2]);assert.equal(foreign.doctor.name,'Directory Other Doctor');assert.equal(foreign.isMine,false);assert.equal(foreign.reason,null);assert.equal(foreign.virtualMeeting,null);assert.equal(foreign.patient.profile,undefined);
  const past=await get('?scope=past&search=Directory%20Test%20Patient');assert.equal(past.data.total,2);assert.equal(past.data.appointments[0].status,'CANCELLED');assert.equal(past.data.appointments[1].status,'COMPLETED');
  const filtered=await get('?scope=all&doctorId='+other+'&status=SCHEDULED');assert(filtered.data.appointments.every(a=>a.doctor.id===other));assert.equal((await get('?scope=all&search=SC-'+patient)).data.total,3);
  for(const query of ['?scope=bad','?page=0','?page=1.5','?doctorId=bad','?status=bad','?start=2026-02-30','?start=2030-01-02&end=2030-01-01'])assert.equal((await get(query)).status,400,query);
  const wrong=await fetch(base+'/api/doctor/appointments/'+appointments[2]+'/notes',{method:'PATCH',headers:{'x-test-role':'DOCTOR','Content-Type':'application/json'},body:JSON.stringify({observations:'Unauthorized change'})});assert.equal(wrong.status,404);
  const context=await fetch(base+'/api/doctor/appointment-context?appointmentId='+appointments[2],{headers:{'x-test-role':'DOCTOR'}});assert.equal(context.status,200);
  const cancel=await fetch(base+'/api/doctor/appointments/'+appointments[2]+'/status',{method:'PATCH',headers:{'x-test-role':'DOCTOR','Content-Type':'application/json'},body:JSON.stringify({status:'CANCELLED'})});assert.equal(cancel.status,404);
  assert.equal((await get('?scope=upcoming','OTHER')).data.appointments.filter(a=>a.id===appointments[2]).length,1);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await pool.query('DELETE FROM appointments WHERE id=ANY($1::uuid[])',[appointments]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[doctor,other,patient]]);await pool.end();}
});
