(function () {
  const dateGrid = document.getElementById('date-grid');
  const monthLabel = document.getElementById('month-label');
  const slotsContainer = document.getElementById('slots-container');
  const summaryDoctor = document.getElementById('summary-doctor');
  const summaryService = document.getElementById('summary-service');
  const summaryReason = document.getElementById('summary-reason');
  const summaryTime = document.getElementById('summary-time');
  const confirmButton = document.getElementById('confirm-slot');
  const message = document.getElementById('slot-message');
  const modal = document.getElementById('details-modal');
  const detailsForm = document.getElementById('details-form');
  const documentUploadForm = document.getElementById('booking-document-upload-form');
  const documentUploadMessage = document.getElementById('booking-document-upload-message');
  let uploadingDocument = false;
  const recoveryKey = 'sumohanPendingRazorpay';
  let paymentConfig = {provider:'demo',ready:false};
  function pendingPayment() { try{return JSON.parse(sessionStorage.getItem(recoveryKey) || 'null');}catch(_){return null;} }
  async function paymentRequest(path,body) {
    const response=await fetch('/api/patient/razorpay/'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok)throw new Error(data.message || 'Unable to confirm payment.');return data;
  }
  async function finishGatewayResult(result) {
    if(result.outcome==='REFUNDED') {
      sessionStorage.removeItem(recoveryKey);setMessage('Payment was refunded. No appointment was created for this payment. Contact the hospital with reference '+result.paymentId);confirmButton.disabled=false;return;
    }
    if(result.outcome==='REQUIRES_REVIEW') {
      setMessage(`Payment received, but the booking needs hospital review. Contact +91 86188 18012 with reference ${result.paymentId}. Please do not pay again.`,'error');
      confirmButton.disabled=true;return;
    }
    if(result.outcome==='BOOKED') {
      sessionStorage.removeItem(recoveryKey);
      if(window.PatientShell?.navigate)await window.PatientShell.navigate('/patient/appointments.html');else location.href='/patient/appointments.html';
      return;
    }
    throw new Error('Payment confirmation is pending. Use Check payment status before trying another payment.');
  }
  async function checkPendingPayment() {
    const pending=pendingPayment();if(!pending)throw new Error('No pending checkout found.');
    const result=pending.proof?await paymentRequest(pending.paymentId+'/verify',pending.proof):await paymentRequest(pending.paymentId+'/status');
    await finishGatewayResult(result);
  }
  function loadCheckout() {
    if(window.Razorpay)return Promise.resolve();
    if(!window.sumohanRazorpayLoader)window.sumohanRazorpayLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';
      script.onload=()=>window.Razorpay?resolve():reject(new Error('Checkout did not load. Please try again.'));
      script.onerror=()=>{window.sumohanRazorpayLoader=null;reject(new Error('Unable to load secure checkout. Check your connection.'));};document.head.appendChild(script);
    });
    return window.sumohanRazorpayLoader;
  }
  async function payWithRazorpay(body) {
    if(!paymentConfig.ready)throw new Error('Online payment is not configured yet. Please contact the hospital.');
    if(pendingPayment()) {await checkPendingPayment();return;}
    await loadCheckout();
    const order=await paymentRequest('order',body);
    sessionStorage.setItem(recoveryKey,JSON.stringify({paymentId:order.paymentId}));
    recovery.hidden=false;
    await new Promise((resolve,reject)=>{
      let submitted=false;
      const checkout=new window.Razorpay({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'Sumohan Care',description:'Consultation booking',
        handler:async proof=>{submitted=true;sessionStorage.setItem(recoveryKey,JSON.stringify({paymentId:order.paymentId,proof}));
          try {setMessage('Verifying payment and confirming your appointment…');await finishGatewayResult(await paymentRequest(order.paymentId+'/verify',proof));resolve();}
          catch(error){reject(error);}},
        modal:{ondismiss:()=>{if(!submitted){sessionStorage.removeItem(recoveryKey);reject(new Error('Checkout closed. Your appointment has not been confirmed. If money was debited, check Visits or contact the hospital before paying again.'));}}},
      });
      checkout.on('payment.failed',()=>setMessage('Payment attempt failed. You can retry in Checkout or close it.','error'));
      checkout.open();
    });
  }
  let selectedDate = null;
  let selectedSlot = null;
  let booking = {};
  let availabilityRows = [];
  let bookedRows = [];
  let defaultSlots = [];
  let currentMonth = new Date(todayYmd() + 'T12:00:00');
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

  function ymd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function todayYmd() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function slotMinutes(slot) {
    const match = String(slot || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  function nowMinutes() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    return Number(parts.find(part => part.type === 'hour').value) * 60 + Number(parts.find(part => part.type === 'minute').value);
  }

  function isPastDate(date) {
    return date < todayYmd();
  }

  function isPastOrCurrentSlot(date, slot) {
    if (date !== todayYmd()) return false;
    const minutes = slotMinutes(slot);
    return minutes == null || minutes <= nowMinutes();
  }

  function isValidFutureSelection(date, slot) {
    return Boolean(date && slot && !isPastDate(date) && !isPastOrCurrentSlot(date, slot));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
  }

  function setMessage(text, tone = 'info') {
    message.textContent = text;
    message.className = tone === 'error' ? 'mt-4 font-bold text-[#ba1a1a]' : 'mt-4 font-bold text-[#006a62]';
  }

  function money(value, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(value || 0));
  }

  function resetBookingButton() {
    if (confirmButton) confirmButton.textContent = 'Finish & Confirm Booking';
  }

  function availabilityFor(date) {
    return availabilityRows.find((item) => item.date === date);
  }

  function bookedSlotsFor(date) {
    return bookedRows.filter((item) => item.date === date).map((item) => item.slot);
  }

  function slotsFor(date) {
    if (!date || isPastDate(date)) return [];
    const rule = availabilityFor(date);
    if (rule && !rule.is_available) return [];
    const base = rule ? rule.slots : defaultSlots;
    const booked = bookedSlotsFor(date);
    return base.filter((slot) => !booked.includes(slot) && !isPastOrCurrentSlot(date, slot));
  }

  function renderCalendar() {
    monthLabel.textContent = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(currentMonth);
    dateGrid.innerHTML = '';
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const days = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first.getDay(); i += 1) dateGrid.insertAdjacentHTML('beforeend', '<span></span>');
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const value = ymd(date);
      const available = !isPastDate(value) && slotsFor(value).length > 0;
      const active = selectedDate === value;
      dateGrid.insertAdjacentHTML('beforeend', `<button class="h-11 rounded-lg font-bold ${active ? 'bg-[#b0004a] text-white' : available ? 'hover:bg-[#edecff]' : 'text-[#b9b6d8]'}" data-date="${value}" ${available ? '' : 'disabled'} type="button">${day}</button>`);
    }
    dateGrid.querySelectorAll('[data-date]').forEach((button) => button.addEventListener('click', () => {
      selectedDate = button.dataset.date;
      selectedSlot = null;
      resetBookingButton();
      renderCalendar();
      renderSlots();
      syncSummary();
    }));
  }

  function renderSlots() {
    const slots = selectedDate ? slotsFor(selectedDate) : [];
    slotsContainer.innerHTML = slots.length ? slots.map((slot) => `<button class="rounded-lg border border-[#e3bdc3] px-5 py-3 text-lg font-bold ${selectedSlot === slot ? 'border-[#b0004a] bg-[#81f3e5]' : 'bg-white'}" data-slot="${slot}" type="button">${slot}</button>`).join('') : '<p class="text-[#5a4044]">No future slots available for this date. Please choose a later date.</p>';
    slotsContainer.querySelectorAll('[data-slot]').forEach((button) => button.addEventListener('click', async () => {
      selectedSlot = button.dataset.slot;
      resetBookingButton();
      await fetch('/api/patient/booking/slot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, time: selectedSlot }) });
      renderSlots();
      syncSummary();
    }));
  }

  function syncSummary() {
    if(summaryDoctor)summaryDoctor.textContent='A doctor is recorded when they attend your appointment.';
    summaryService.textContent = booking.service || '-';
    summaryReason.textContent = booking.otherReason || booking.reason || '-';
    summaryTime.textContent = selectedDate && selectedSlot ? `${formatDate(selectedDate)} - ${selectedSlot}` : '-';
    const validSelection = isValidFutureSelection(selectedDate, selectedSlot);
    if (confirmButton) confirmButton.disabled = !validSelection;
    confirmButton?.classList.toggle('opacity-50', !validSelection);
    confirmButton?.classList.toggle('cursor-not-allowed', !validSelection);
    if (confirmButton) confirmButton.textContent = 'Finish & Confirm Booking';
  }

  async function loadAvailability() {
    const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const response=await fetch('/api/patient/booking/availability?month='+month);
    const data=await response.json();if(!response.ok)throw new Error(data.message || 'Unable to load hospital times.');
    availabilityRows=[];bookedRows=[];defaultSlots=data.defaultSlots || [];
    renderCalendar();
    renderSlots();
  }

  async function init() {
    paymentConfig=await paymentRequest('config');
    const bookingRes=await fetch('/api/patient/booking');const bookingData=await bookingRes.json();if(!bookingRes.ok)throw new Error(bookingData.message);booking=bookingData.booking || {};
    selectedDate = booking.date && !isPastDate(booking.date) ? booking.date : null;
    selectedSlot = selectedDate && booking.time && !isPastOrCurrentSlot(selectedDate, booking.time) ? booking.time : null;
    const profileResponse = await fetch('/api/patient/profile');
    if (profileResponse.ok) { const profile = await profileResponse.json(); document.getElementById('booking-declaration-name').value = profile.patient?.display_name || ''; }
    syncSummary();
    await loadAvailability();
  }

  document.getElementById('prev-month')?.addEventListener('click', async () => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const now = new Date();
    const minimumMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (previous < minimumMonth) return;
    currentMonth = previous;
    await loadAvailability();
  });
  document.getElementById('next-month')?.addEventListener('click', async () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1); await loadAvailability(); });
  document.querySelectorAll('[data-edit-details]').forEach((button) => button.addEventListener('click', () => {
    detailsForm.service.value = booking.service || '';
    detailsForm.reason.value = booking.reason || '';
    detailsForm.otherReason.value = booking.otherReason || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }));
  document.getElementById('details-cancel')?.addEventListener('click', () => { modal.classList.add('hidden'); modal.classList.remove('flex'); });
  detailsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(detailsForm).entries());
    const response = await fetch('/api/patient/booking/details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    booking = data.booking || booking;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    syncSummary();
  });
  confirmButton?.addEventListener('click', async () => {
    if (uploadingDocument) { setMessage('Please wait for your report upload to finish before confirming.','error'); return; }
    if (!isValidFutureSelection(selectedDate, selectedSlot)) { setMessage('Please choose a future date and slot.', 'error'); return; }
    const medicalConsent = document.getElementById('booking-medical-consent').checked;
    const accuracyConsent = document.getElementById('booking-accuracy-consent').checked;
    const declarationName = document.getElementById('booking-declaration-name').value.trim();
    if (!medicalConsent || !accuracyConsent || !declarationName) { setMessage('Acknowledge both declarations and enter the patient name.', 'error'); document.getElementById('booking-declaration-name').scrollIntoView({block:'center',behavior:'smooth'}); return; }
    confirmButton.disabled = true;
    setMessage(paymentConfig.provider==='demo'?'Preparing demo payment…':'Preparing secure checkout…');
    try {
      if(paymentConfig.provider!=='demo') {
        await payWithRazorpay({date:selectedDate,time:selectedSlot,medicalConsent,accuracyConsent,declarationName});return;
      }
      const headers = { 'Content-Type': 'application/json' };
      const bookingResponse = await fetch('/api/patient/booking/payment', { method: 'POST', headers, body: JSON.stringify({ date: selectedDate, time: selectedSlot }) });
      const paymentData = await bookingResponse.json();
      if (!bookingResponse.ok) throw new Error(paymentData.message || 'Could not prepare payment.');
      setMessage('Completing demo payment and creating your Meet link...');
      const response = await fetch(`/api/patient/booking/payment/${encodeURIComponent(paymentData.payment.id)}/pay-and-book`, { method: 'PATCH', headers, body: JSON.stringify({ date: selectedDate, time: selectedSlot, medicalConsent, accuracyConsent, declarationName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not complete the demo payment and booking.');
      if (window.PatientShell?.navigate) await window.PatientShell.navigate(data.redirectTo);
      else location.href = data.redirectTo;
    } catch(error) { setMessage(error.message,'error'); confirmButton.disabled = false; }
  });
  documentUploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (uploadingDocument) return;
    uploadingDocument = true;
    const uploadButton = documentUploadForm.querySelector('button[type="submit"]');
    uploadButton.disabled = true;
    documentUploadMessage.innerHTML = '<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>Uploading...</span></span>';
    try {
      const formData = new FormData(documentUploadForm);
      formData.append('uploadedDuring', 'slot_booking');
      const response = await fetch('/api/patient/documents', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed.');
      documentUploadMessage.textContent = 'Document uploaded for doctor review.';
      documentUploadForm.reset();
    } catch (error) {
      documentUploadMessage.textContent = error.message;
    } finally {
      uploadingDocument = false;
      uploadButton.disabled = false;
    }
  });

  const recovery=document.createElement('button');recovery.type='button';recovery.className='patient-secondary-button';recovery.textContent='Check payment status';recovery.hidden=!pendingPayment();
  message?.after(recovery);
  recovery.addEventListener('click',async()=>{recovery.disabled=true;try{await checkPendingPayment();}catch(error){setMessage(error.message,'error');}finally{recovery.disabled=false;}});
  init().catch((error) => {confirmButton.disabled=true;setMessage(error.message, 'error');});
})();
