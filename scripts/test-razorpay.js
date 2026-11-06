require('dotenv').config({quiet:true});
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),express=require('express');
const {pool}=require('../server/db');
require('../server/meeting').createConsultationMeeting=async()=>({provider:'test',mode:'test',meetLink:null});
const {patientRouter}=require('../server/patient');
const {adminRouter}=require('../server/admin');
const {requireRole}=require('../server/access');
const {webhookHandler}=require('../server/razorpay-payments');
const gateway=require('../server/razorpay');

test('Razorpay checkout, ownership, signatures, webhook recovery and duplicate capture protection',async()=>{
  const ids={doctor:crypto.randomUUID(),patient:crypto.randomUUID(),other:crypto.randomUUID()};
  const envKeys=['PAYMENT_PROVIDER','RAZORPAY_MODE','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET'];
  const originalEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{PAYMENT_PROVIDER:'razorpay',RAZORPAY_MODE:'test',RAZORPAY_KEY_ID:'rzp_test_simulated',RAZORPAY_KEY_SECRET:'test-key-secret',RAZORPAY_WEBHOOK_SECRET:'test-hook-secret'});
  const originalFetch=global.fetch;const providerPayments=new Map();let lastOrder,server,orders=0;const sessions={};
  global.fetch=async(url,options)=>{
    if(!String(url).startsWith('https://api.razorpay.com/'))return originalFetch(url,options);
    if(String(url).endsWith('/orders')){lastOrder=JSON.parse(options.body);return Response.json({...lastOrder,id:'order_'+(++orders)});}
    const payment=providerPayments.get(String(url).split('/').at(-1));
    return payment?Response.json(payment):Response.json({error:{}},{status:404});
  };
  try {
    await pool.query(`INSERT INTO users (id,role,display_name,profile,metadata) VALUES
      ($1,'DOCTOR','Razorpay Test Doctor','{"consultationFee":800}','{"test":true}'),
      ($2,'PATIENT','Razorpay Test Patient','{}','{"test":true}'),
      ($3,'PATIENT','Razorpay Other Patient','{}','{"test":true}')`,[ids.doctor,ids.patient,ids.other]);
    const app=express();app.post('/api/payments/razorpay/webhook',express.raw({type:'application/json'}),webhookHandler);app.use(express.json());
    app.use((req,_res,next)=>{const role=req.get('x-test-role');req.session=sessions[role || 'anonymous'] ||= {};if(role){req.session.user={id:role==='OTHER'?ids.other:ids.patient,role:role==='ADMIN'?'ADMIN':'PATIENT'};if(role==='ADMIN')req.session.adminUser=req.session.user;else req.session.patientUser=req.session.user;}next();});
    app.use('/api/patient',requireRole('PATIENT'),patientRouter);app.use('/api/admin',requireRole('ADMIN'),adminRouter);
    app.use((error,_req,res,_next)=>res.status(error.status || 500).json({message:error.message}));
    server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
    const base='http://127.0.0.1:'+server.address().port;
    async function call(path,body,role='PATIENT',method='POST'){
      const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(role?{'x-test-role':role}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};
    }
    const booking={service:'Gynecology',reason:'Test consultation',consultationType:'NEW',doctorId:ids.doctor};
    const declaration={date:'2030-02-10',time:'09:00 AM',medicalConsent:true,accuracyConsent:true,declarationName:'Razorpay Test Patient'};
    await call('/api/patient/booking/reason',booking);
    assert.equal(gateway.configuration().ready,true);
    assert.equal((await call('/api/patient/booking/payment',declaration)).status,409);
    assert.equal((await call('/api/patient/booking/confirm',declaration)).status,409);
    assert.equal((await call('/api/patient/razorpay/order',declaration,null)).status,401);
    const savedSecret=process.env.RAZORPAY_KEY_SECRET;delete process.env.RAZORPAY_KEY_SECRET;
    assert.equal((await call('/api/patient/razorpay/order',declaration)).status,503);process.env.RAZORPAY_KEY_SECRET=savedSecret;
    assert.equal((await call('/api/patient/razorpay/order',{...declaration,medicalConsent:false})).status,400);
    await pool.query("UPDATE users SET profile=profile - 'consultationFee' WHERE id=$1",[ids.doctor]);
    assert.equal((await call('/api/patient/razorpay/order',declaration)).status,400);
    await pool.query("UPDATE users SET profile=profile || '{\"consultationFee\":800}'::jsonb WHERE id=$1",[ids.doctor]);
    const order=await call('/api/patient/razorpay/order',{...declaration,amount:1});assert.equal(order.status,201);
    assert.equal(order.data.amount,80000);assert.equal(lastOrder.amount,80000);assert.equal(lastOrder.partial_payment,false);
    assert.deepEqual(Object.keys(lastOrder.notes),['paymentReference']);assert(!JSON.stringify(order.data).includes('test-key-secret'));
    const id=order.data.paymentId;
    function capture(orderInfo,paymentId,extras={}){providerPayments.set(paymentId,{id:paymentId,order_id:orderInfo.orderId,amount:orderInfo.amount,currency:'INR',status:'captured',captured:true,...extras});}
    function proof(orderInfo,paymentId){return {razorpay_order_id:orderInfo.orderId,razorpay_payment_id:paymentId,razorpay_signature:crypto.createHmac('sha256','test-key-secret').update(orderInfo.orderId+'|'+paymentId).digest('hex')};}
    const verify='/api/patient/razorpay/'+id+'/verify';capture(order.data,'pay_test1');const signed=proof(order.data,'pay_test1');
    assert.equal((await call(verify,signed,'OTHER')).status,404);
    assert.equal((await call(verify,{...signed,razorpay_signature:'0'.repeat(64)})).status,400);
    capture(order.data,'pay_test1',{amount:1});assert.equal((await call(verify,signed)).status,400);
    capture(order.data,'pay_test1',{status:'authorized',captured:false});assert.equal((await call(verify,signed)).status,409);
    capture(order.data,'pay_test1');
    const booked=await call(verify,signed);assert.equal(booked.status,200);assert.equal(booked.data.outcome,'BOOKED');
    const repeat=await call(verify,signed);assert.equal(repeat.data.appointmentId,booked.data.appointmentId);
    assert.equal((await call('/api/admin/payments/'+id+'/status',{status:'REFUNDED'},'ADMIN','PATCH')).status,409);
    assert.equal((await call('/api/patient/razorpay/'+id+'/status',null,'OTHER','GET')).status,404);
    async function hook(orderInfo,paymentId,event='payment.captured',signature){
      const body=JSON.stringify({event,payload:{payment:{entity:{id:paymentId,order_id:orderInfo.orderId}}}});
      const response=await fetch(base+'/api/payments/razorpay/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':signature || crypto.createHmac('sha256','test-hook-secret').update(body).digest('hex')},body});return {status:response.status,data:await response.json()};
    }
    assert.equal((await hook(order.data,'pay_test1','payment.captured','0'.repeat(64))).status,400);
    assert.equal((await hook(order.data,'pay_test1')).status,200);
    assert.equal((await hook(order.data,'pay_test1','payment.failed')).status,200);
    assert.equal((await pool.query('SELECT status FROM payments WHERE id=$1',[id])).rows[0].status,'PAID');
    assert.equal((await pool.query('SELECT count(*) FROM appointments WHERE patient_id=$1',[ids.patient])).rows[0].count,'1');
    assert.equal((await pool.query("SELECT count(*) FROM notifications WHERE user_id=$1 AND title='New consultation'",[ids.doctor])).rows[0].count,'1');
    // Simulate a lost checkout callback: a signed webhook completes the saved booking without any session.
    await call('/api/patient/booking/reason',booking);
    const second=await call('/api/patient/razorpay/order',{...declaration,time:'09:15 AM'});capture(second.data,'pay_test2');
    assert.equal((await hook(second.data,'pay_test2','order.paid')).status,200);
    assert.equal((await call('/api/patient/razorpay/'+second.data.paymentId+'/status',null,'PATIENT','GET')).data.outcome,'BOOKED');
    // A paid slot conflict becomes a review item instead of silently losing the payment or double-booking.
    const conflict=await call('/api/patient/razorpay/order',{...declaration,time:'09:30 AM'});
    await pool.query("INSERT INTO appointments (doctor_id,patient_id,appointment_at,service_type,status) VALUES ($1,$2,'2030-02-10T09:30:00+05:30','Test','SCHEDULED')",[ids.doctor,ids.other]);
    capture(conflict.data,'pay_test3');assert.equal((await hook(conflict.data,'pay_test3')).status,200);
    const review=await call('/api/patient/razorpay/'+conflict.data.paymentId+'/status',null,'PATIENT','GET');assert.equal(review.data.status,'PAID');assert.equal(review.data.outcome,'REQUIRES_REVIEW');assert.equal(review.data.appointmentId,null);
    capture(conflict.data,'pay_test3',{status:'refunded',amount_refunded:conflict.data.amount});
    const refundBody=JSON.stringify({event:'refund.processed',payload:{refund:{entity:{payment_id:'pay_test3'}}}});
    const refundResponse=await fetch(base+'/api/payments/razorpay/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':crypto.createHmac('sha256','test-hook-secret').update(refundBody).digest('hex')},body:refundBody});
    assert.equal(refundResponse.status,200);
    const refunded=await call('/api/patient/razorpay/'+conflict.data.paymentId+'/status',null,'PATIENT','GET');assert.equal(refunded.data.status,'REFUNDED');assert.equal(refunded.data.outcome,'REFUNDED');
    assert.equal(gateway.amountInPaise('800.50'),80050);assert.throws(()=>gateway.amountInPaise('0'));assert.throws(()=>gateway.amountInPaise('1.001'));
  } finally {
    global.fetch=originalFetch;for(const key of envKeys){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.query('DELETE FROM payments WHERE patient_id=ANY($1::uuid[])',[[ids.patient,ids.other]]);
    await pool.query('DELETE FROM appointments WHERE doctor_id=$1',[ids.doctor]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[Object.values(ids)]);await pool.end();
  }
});
