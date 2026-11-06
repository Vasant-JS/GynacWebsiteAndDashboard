const express=require('express');
const {pool}=require('./db');
const gateway=require('./razorpay');
const {createConsultationMeeting}=require('./meeting');
const patientPaymentRouter=express.Router();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || ''));

async function finalize(paymentId,providerPaymentId) {
  if(!/^pay_[a-zA-Z0-9]+$/.test(String(providerPaymentId)))throw fail('Invalid payment reference.');
  const captured=await gateway.fetchPayment(providerPaymentId);
  const client=await pool.connect();let result,created=false,patient,doctor;
  try {
    await client.query('BEGIN');
    const row=(await client.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE',[paymentId])).rows[0];
    if(!row || row.metadata?.gateway!=='razorpay')throw fail('Payment not found.',404);
    if(captured.id!==providerPaymentId || captured.order_id!==row.metadata.razorpayOrderId || captured.currency!==row.currency || captured.amount!==gateway.amountInPaise(row.amount))throw fail('Payment details do not match this booking.');
    if(row.metadata.razorpayPaymentId && row.metadata.razorpayPaymentId!==providerPaymentId)throw fail('Payment reference does not match.');
    if(row.status==='PAID' || row.status==='REFUNDED') {
      await client.query('COMMIT');return {paymentId:row.id,appointmentId:row.appointment_id,outcome:row.metadata.bookingOutcome || 'BOOKED',redirectTo:'/patient/appointments.html'};
    }
    if(captured.status!=='captured' || captured.captured!==true)throw fail('Payment is awaiting confirmation. Please check your booking again shortly.',409);
    const booking=row.metadata.booking;
    if(!booking || !booking.consent)throw fail('Booking details are unavailable.',409);
    doctor=(await client.query("SELECT * FROM users WHERE id=$1 AND role='DOCTOR' AND status='ACTIVE' FOR UPDATE",[booking.doctorId])).rows[0];
    patient=(await client.query("SELECT * FROM users WHERE id=$1 AND role='PATIENT'",[row.patient_id])).rows[0];
    let appointmentAt,reviewReason;
    const {assertSlotAvailable,bookingDeclaration,bookingHistoryMetadata}=require('./patient');
    try {
      if(!doctor || !patient)throw fail('The doctor or patient is no longer available.',409);
      await bookingDeclaration(booking,{...patient,display_name:booking.consent.patientName},{medicalConsent:true,accuracyConsent:true,declarationName:booking.consent.patientName},client);
      appointmentAt=await assertSlotAvailable(doctor.id,booking.date,booking.time,null,client);
      if(captured.amount_refunded>0)reviewReason='Payment was partially refunded before booking confirmation.';
    } catch(error) {
      if(![400,409].includes(error.status))throw error;
      reviewReason=error.message;
    }
    let appointmentId=null;
    if(!reviewReason) {
      const appointment=await client.query(`INSERT INTO appointments (doctor_id,patient_id,appointment_at,service_type,status,location,notes,metadata,duration_minutes)
        VALUES ($1,$2,$3,$4,'SCHEDULED','Sumohan Hospital, Shivamogga',$5::jsonb,$6::jsonb,15) RETURNING id`,[
        doctor.id,patient.id,appointmentAt,booking.service,JSON.stringify({reason:booking.reason,otherReason:booking.otherReason || null}),
        JSON.stringify({source:'razorpay_booking',fee:Number(row.amount),paymentId:row.id,...bookingHistoryMetadata(booking,booking.consent)}),
      ]);
      appointmentId=appointment.rows[0].id;created=true;
      if(booking.documentIds?.length)await client.query('UPDATE medical_documents SET appointment_id=$1 WHERE id=ANY($2::uuid[]) AND patient_id=$3 AND appointment_id IS NULL',[appointmentId,booking.documentIds,patient.id]);
      await client.query("INSERT INTO notifications (user_id,title,body,category,metadata) VALUES ($1,'Appointment booked',$2,'APPOINTMENT',$3::jsonb),($4,'New consultation',$2,'APPOINTMENT',$3::jsonb)",[patient.id,`${booking.service} on ${booking.date} at ${booking.time}`,JSON.stringify({appointmentId}),doctor.id]);
    }
    const outcome=reviewReason?'REQUIRES_REVIEW':'BOOKED';
    await client.query("UPDATE payments SET status='PAID',appointment_id=$1,metadata=metadata || $2::jsonb WHERE id=$3",[appointmentId,JSON.stringify({razorpayPaymentId:providerPaymentId,reference:providerPaymentId,paidAt:new Date().toISOString(),bookingOutcome:outcome,...(reviewReason?{requiresReview:true,reviewReason}: {})}),row.id]);
    await client.query('COMMIT');
    result={paymentId:row.id,appointmentId,outcome,redirectTo:'/patient/appointments.html'};
  } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  if(created) {
    let meeting;
    try {meeting=await createConsultationMeeting({appointmentId:result.appointmentId,appointmentAt:(await pool.query('SELECT appointment_at FROM appointments WHERE id=$1',[result.appointmentId])).rows[0].appointment_at,patient,doctor,serviceType:'Consultation',durationMinutes:15});}
    catch(_){meeting={provider:'google_meet',mode:'failed',meetLink:null};}
    await pool.query("UPDATE appointments SET metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({virtualMeeting:meeting}),result.appointmentId]);
  }
  return result;
}

patientPaymentRouter.get('/config',(_req,res)=>{res.set('Cache-Control','no-store');res.json(gateway.configuration());});
patientPaymentRouter.post('/order',async(req,res,next)=>{
  let localId;
  try {
    gateway.requireConfigured();
    const {bookingContext,bookingDeclaration}=require('./patient');
    const {booking,patient,doctor}=await bookingContext(req,req.body);
    const consent=await bookingDeclaration(booking,patient,req.body,pool);
    const amount=gateway.amountInPaise(doctor.profile?.consultationFee);
    // Store a server-side snapshot; webhooks must not depend on a browser session.
    const snapshot={...booking,doctorId:doctor.id,doctorName:doctor.display_name,consent};delete snapshot.paymentId;
    const row=await pool.query("INSERT INTO payments (patient_id,amount,currency,status,metadata) VALUES ($1,$2,'INR','PENDING',$3::jsonb) RETURNING id",[patient.id,(amount/100).toFixed(2),JSON.stringify({gateway:'razorpay',mode:gateway.configuration().mode,booking:snapshot})]);
    localId=row.rows[0].id;
    const order=await gateway.createOrder(amount,localId);
    if(!order.id || order.amount!==amount || order.currency!=='INR')throw fail('The payment order could not be verified.',502);
    await pool.query('UPDATE payments SET metadata=metadata || $1::jsonb WHERE id=$2',[JSON.stringify({razorpayOrderId:order.id}),localId]);
    res.status(201).json({paymentId:localId,orderId:order.id,amount,currency:'INR',keyId:gateway.configuration().keyId});
  } catch(error){if(localId)await pool.query("UPDATE payments SET status='FAILED' WHERE id=$1",[localId]);if(error.status)return res.status(error.status).json({message:error.message});next(error);}
});
patientPaymentRouter.post('/:id/verify',async(req,res,next)=>{
  try {
    gateway.requireConfigured();if(!uuid(req.params.id))throw fail('Payment not found.',404);
    const row=(await pool.query("SELECT * FROM payments WHERE id=$1 AND patient_id=$2 AND metadata->>'gateway'='razorpay'",[req.params.id,req.authUser.id])).rows[0];
    if(!row)throw fail('Payment not found.',404);
    if(req.body.razorpay_order_id!==row.metadata.razorpayOrderId || !gateway.verifyCheckout(row.metadata.razorpayOrderId,req.body.razorpay_payment_id,req.body.razorpay_signature))throw fail('Invalid payment verification.',400);
    const result=await finalize(row.id,req.body.razorpay_payment_id);
    if(result.outcome==='BOOKED' && req.session.booking?.date===row.metadata.booking.date && req.session.booking?.time===row.metadata.booking.time && req.session.booking?.doctorId===row.metadata.booking.doctorId)req.session.booking={};
    res.json(result);
  } catch(error){if(error.status)return res.status(error.status).json({message:error.message});next(error);}
});
patientPaymentRouter.get('/:id/status',async(req,res,next)=>{
  try {
    if(!uuid(req.params.id))throw fail('Payment not found.',404);
    const row=(await pool.query("SELECT id,status,appointment_id,metadata->>'bookingOutcome' AS outcome FROM payments WHERE id=$1 AND patient_id=$2 AND metadata->>'gateway'='razorpay'",[req.params.id,req.authUser.id])).rows[0];
    if(!row)throw fail('Payment not found.',404);res.set('Cache-Control','no-store');res.json({paymentId:row.id,status:row.status,appointmentId:row.appointment_id,outcome:row.outcome});
  }catch(error){if(error.status)return res.status(error.status).json({message:error.message});next(error);}
});

async function webhookHandler(req,res,next) {
  try {
    gateway.requireConfigured();
    if(!gateway.verifyWebhook(req.body,req.get('x-razorpay-signature')))return res.status(400).json({message:'Invalid webhook signature.'});
    let event;try{event=JSON.parse(req.body.toString('utf8'));}catch(_){return res.status(400).json({message:'Invalid webhook payload.'});}
    if(event.event==='refund.processed') {
      const refund=event.payload?.refund?.entity;
      if(!/^pay_[a-zA-Z0-9]+$/.test(String(refund?.payment_id || '')))return res.status(400).json({message:'Invalid refund payment.'});
      const payment=await gateway.fetchPayment(refund.payment_id);
      const row=(await pool.query("SELECT * FROM payments WHERE metadata->>'gateway'='razorpay' AND metadata->>'razorpayOrderId'=$1",[payment.order_id])).rows[0];
      if(!row)return res.json({received:true,ignored:true});
      if(payment.id!==refund.payment_id || payment.amount!==gateway.amountInPaise(row.amount) || payment.currency!==row.currency || !Number.isSafeInteger(payment.amount_refunded) || payment.amount_refunded<=0 || payment.amount_refunded>payment.amount)throw fail('Refund details could not be verified.');
      const full=payment.amount_refunded===payment.amount;
      await pool.query(`UPDATE payments SET status=$1,metadata=metadata || $2::jsonb ||
        CASE WHEN appointment_id IS NULL THEN $5::jsonb ELSE '{}'::jsonb END
        WHERE id=$3 AND (metadata->>'razorpayPaymentId' IS NULL OR metadata->>'razorpayPaymentId'=$4)`,[
        full?'REFUNDED':'PAID',JSON.stringify({razorpayPaymentId:payment.id,reference:payment.id,refundedAmount:payment.amount_refunded/100}),row.id,payment.id,
        JSON.stringify({bookingOutcome:full?'REFUNDED':'REQUIRES_REVIEW',requiresReview:!full,reviewReason:'Refund received before booking could be confirmed.'})]);
      return res.json({received:true});
    }
    if(!['payment.captured','order.paid','payment.failed'].includes(event.event))return res.json({received:true});
    const payment=event.payload?.payment?.entity;
    if(!payment?.id || !payment?.order_id)return res.status(400).json({message:'Missing payment details.'});
    const row=(await pool.query("SELECT * FROM payments WHERE metadata->>'gateway'='razorpay' AND metadata->>'razorpayOrderId'=$1",[payment.order_id])).rows[0];
    if(!row)return res.json({received:true,ignored:true});
    if(event.event==='payment.failed') {
      // One order may have several attempts. A late failure must never undo a captured payment.
      await pool.query("UPDATE payments SET metadata=metadata || $1::jsonb WHERE id=$2 AND status NOT IN ('PAID','REFUNDED')",[JSON.stringify({lastFailureAt:new Date().toISOString()}),row.id]);
    } else await finalize(row.id,payment.id);
    res.json({received:true});
  }catch(error){if(error.status)return res.status(error.status).json({message:error.message});next(error);}
}
module.exports={patientPaymentRouter,webhookHandler,finalize};
