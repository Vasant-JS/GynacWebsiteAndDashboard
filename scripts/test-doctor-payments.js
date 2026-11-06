require('dotenv').config({ quiet: true });
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { pool } = require('../server/db');
const { requireRole } = require('../server/access');
const { doctorRouter } = require('../server/doctor');

test('doctor payment history scopes bookings, separates currencies and validates filters', async () => {
  const doctor = randomUUID(), other = randomUUID(), patient = randomUUID();
  const appointments = [randomUUID(), randomUUID(), randomUUID()];
  let server;
  try {
    await pool.query(`INSERT INTO users (id,role,display_name,metadata) VALUES
      ($1,'DOCTOR','Payment Test Doctor','{"test":true}'),
      ($2,'DOCTOR','Payment Other Doctor','{"test":true}'),
      ($3,'PATIENT','Payment Test Patient','{"test":true}')`, [doctor,other,patient]);
    await pool.query(`INSERT INTO appointments (id,doctor_id,patient_id,appointment_at,service_type,status) VALUES
      ($1,$4,$6,'2026-11-01T00:00:00+05:30','Gynecology','COMPLETED'),
      ($2,$4,$6,'2026-11-02T10:00:00+05:30','Follow-up','SCHEDULED'),
      ($3,$5,$6,'2026-11-01T10:00:00+05:30','Other doctor visit','SCHEDULED')`, [...appointments,doctor,other,patient]);
    for (const [status,amount,currency] of [['PAID',800,'INR'],['PENDING',200,'INR'],['FAILED',300,'INR'],['REFUNDED',100,'INR'],['PAID',10,'USD']]) {
      await pool.query(`INSERT INTO payments (appointment_id,patient_id,amount,currency,status,metadata) VALUES ($1,$2,$3,$4,$5,'{"mode":"manual_demo"}')`,[appointments[0],patient,amount,currency,status]);
    }
    await pool.query(`INSERT INTO payments (appointment_id,patient_id,amount,status) VALUES ($1,$2,99999,'PAID')`,[appointments[2],patient]);
    const app = express();
    app.use((req,_res,next) => {
      const role=req.headers['x-test-role'];
      req.session = {};
      if (role) { req.session.user={id:role==='PATIENT'?patient:role==='OTHER'?other:doctor,role:role==='PATIENT'?'PATIENT':'DOCTOR'}; req.session.doctorUser=req.session.user; req.session.doctorLastSeen=Date.now(); }
      next();
    });
    app.use('/api/doctor',requireRole('DOCTOR'),doctorRouter);
    app.use((error,_req,res,_next)=>res.status(500).json({message:error.message}));
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    async function get(query='',role='DOCTOR') {
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/doctor/payments${query}`,{headers:role?{'x-test-role':role}:{}});
      return {status:response.status,data:await response.json()};
    }
    assert.equal((await get('',null)).status,401);
    assert.equal((await get('','PATIENT')).status,401);
    const all=await get(`?doctorId=${other}`);
    assert.equal(all.status,200); assert.equal(all.data.total,6); assert.equal(all.data.uncollected,1);
    assert(all.data.records.every(row=>appointments.slice(0,2).includes(row.appointment_id)));
    assert.equal(Number(all.data.summary.find(row=>row.currency==='INR').paid),800);
    assert.equal(Number(all.data.summary.find(row=>row.currency==='USD').paid),10);
    await pool.query("UPDATE payments SET metadata=metadata || '{\"refundedAmount\":50}'::jsonb WHERE appointment_id=$1 AND currency='INR' AND status='PAID'",[appointments[0]]);
    const partialRefund=await get();
    assert.equal(Number(partialRefund.data.summary.find(row=>row.currency==='INR').paid),750);
    assert.equal(Number(partialRefund.data.summary.find(row=>row.currency==='INR').refunded),150);
    assert.equal(all.data.records.filter(row=>row.is_demo).length,5);
    const firstDay=await get('?start=2026-11-01&end=2026-11-01&status=PAID');
    assert.equal(firstDay.data.total,2);
    const uncollected=await get('?status=NOT_COLLECTED');
    assert.equal(uncollected.data.total,1); assert.equal(uncollected.data.records[0].amount,null);
    assert.equal((await get('','OTHER')).data.total,1);
    assert.equal((await get('?page=2')).data.records.length,0);
    for (const query of ['?start=2026-02-30','?start=2026-11-02&end=2026-11-01','?status=INVALID','?page=-1']) assert.equal((await get(query)).status,400);
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    await pool.query('DELETE FROM payments WHERE patient_id=$1',[patient]);
    await pool.query('DELETE FROM appointments WHERE id=ANY($1::uuid[])',[appointments]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[doctor,other,patient]]);
    await pool.end();
  }
});
