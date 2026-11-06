const crypto = require('node:crypto');
function provider() { return process.env.PAYMENT_PROVIDER || 'demo'; }
function configuration() {
  const mode = process.env.RAZORPAY_MODE || 'test';
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const ready = provider() === 'razorpay' && ['test','live'].includes(mode) && keyId.startsWith(`rzp_${mode}_`) && Boolean(process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
  return { provider:provider(), mode, ready, ...(ready ? {keyId} : {}) };
}
function requireConfigured() {
  if (!configuration().ready) throw Object.assign(new Error('Online payment is not configured yet. Please contact the hospital.'),{status:503});
}
function amountInPaise(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw Object.assign(new Error('A confirmed consultation fee with at most two decimal places is required.'),{status:400});
  const amount = Number(match[1])*100 + Number((match[2] || '').padEnd(2,'0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Object.assign(new Error('A positive consultation fee is required.'),{status:400});
  return amount;
}
function validSignature(message,signature,secret) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(String(signature || ''))) return false;
  const expected=crypto.createHmac('sha256',secret).update(message).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
function verifyCheckout(orderId,paymentId,signature) {
  return validSignature(`${orderId}|${paymentId}`,signature,process.env.RAZORPAY_KEY_SECRET);
}
function verifyWebhook(body,signature) { return Buffer.isBuffer(body) && validSignature(body,signature,process.env.RAZORPAY_WEBHOOK_SECRET); }
async function request(path,body) {
  requireConfigured();
  const response = await fetch('https://api.razorpay.com/v1/'+path,{
    method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64'),'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),
  });
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error('Payment provider could not complete this request. Please try again or contact the hospital.'),{status:502});
  return data;
}
module.exports={provider,configuration,requireConfigured,amountInPaise,verifyCheckout,verifyWebhook,
  createOrder:(amount,id)=>request('orders',{amount,currency:'INR',receipt:id,partial_payment:false,notes:{paymentReference:id}}),
  fetchPayment:id=>request('payments/'+encodeURIComponent(id)),
};
