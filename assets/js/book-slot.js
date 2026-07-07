(function () {
  const dateGrid = document.getElementById('date-grid');
  const monthLabel = document.getElementById('month-label');
  const slotsContainer = document.getElementById('slots-container');
  const summaryDoctor = document.getElementById('summary-doctor');
  const summaryDoctorSelect = document.getElementById('summary-doctor-select');
  const summaryService = document.getElementById('summary-service');
  const summaryReason = document.getElementById('summary-reason');
  const summaryTime = document.getElementById('summary-time');
  const confirmButton = document.getElementById('confirm-slot');
  const message = document.getElementById('slot-message');
  const modal = document.getElementById('details-modal');
  const detailsForm = document.getElementById('details-form');
  const documentUploadForm = document.getElementById('booking-document-upload-form');
  const documentUploadMessage = document.getElementById('booking-document-upload-message');
  let selectedDate = null;
  let selectedSlot = null;
  let selectedDoctorId = null;
  let booking = {};
  let doctors = [];
  let availabilityRows = [];
  let bookedRows = [];
  let currentMonth = new Date();

  function ymd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
  }

  function setMessage(text, tone = 'info') {
    message.textContent = text;
    message.className = tone === 'error' ? 'mt-4 font-bold text-[#ba1a1a]' : 'mt-4 font-bold text-[#006a62]';
  }

  function availabilityFor(date) {
    return availabilityRows.find((item) => item.date === date);
  }

  function bookedSlotsFor(date) {
    return bookedRows.filter((item) => item.date === date).map((item) => item.slot);
  }

  function slotsFor(date) {
    const rule = availabilityFor(date);
    if (rule && !rule.is_available) return [];
    const base = rule?.slots?.length ? rule.slots : ['09:00 AM', '09:30 AM', '10:30 AM', '01:00 PM', '02:30 PM', '04:00 PM', '06:30 PM', '07:00 PM', '07:30 PM'];
    const booked = bookedSlotsFor(date);
    return base.filter((slot) => !booked.includes(slot));
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
      const available = slotsFor(value).length > 0;
      const active = selectedDate === value;
      dateGrid.insertAdjacentHTML('beforeend', `<button class="h-11 rounded-lg font-bold ${active ? 'bg-[#b0004a] text-white' : available ? 'hover:bg-[#edecff]' : 'text-[#b9b6d8]'}" data-date="${value}" ${available ? '' : 'disabled'} type="button">${day}</button>`);
    }
    dateGrid.querySelectorAll('[data-date]').forEach((button) => button.addEventListener('click', () => {
      selectedDate = button.dataset.date;
      selectedSlot = null;
      renderCalendar();
      renderSlots();
      syncSummary();
    }));
  }

  function renderSlots() {
    const slots = selectedDate ? slotsFor(selectedDate) : [];
    slotsContainer.innerHTML = slots.length ? slots.map((slot) => `<button class="rounded-lg border border-[#e3bdc3] px-5 py-3 text-lg font-bold ${selectedSlot === slot ? 'border-[#b0004a] bg-[#81f3e5]' : 'bg-white'}" data-slot="${slot}" type="button">${slot}</button>`).join('') : '<p class="text-[#5a4044]">Select an available date to view slots.</p>';
    slotsContainer.querySelectorAll('[data-slot]').forEach((button) => button.addEventListener('click', async () => {
      selectedSlot = button.dataset.slot;
      await fetch('/api/patient/booking/slot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, time: selectedSlot }) });
      renderSlots();
      syncSummary();
    }));
  }

  function syncSummary() {
    const doctor = doctors.find((item) => item.id === selectedDoctorId) || doctors[0];
    summaryDoctor.textContent = doctor ? `${doctor.name} • ${doctor.title}` : '-';
    summaryService.textContent = booking.service || '-';
    summaryReason.textContent = booking.otherReason || booking.reason || '-';
    summaryTime.textContent = selectedDate && selectedSlot ? `${formatDate(selectedDate)} • ${selectedSlot}` : '-';
  }

  async function loadAvailability() {
    const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const response = await fetch(`/api/patient/booking/availability?doctorId=${encodeURIComponent(selectedDoctorId || '')}&month=${month}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load availability.');
    availabilityRows = data.availability || [];
    bookedRows = data.booked || [];
    renderCalendar();
    renderSlots();
  }

  async function init() {
    const [bookingRes, doctorRes] = await Promise.all([fetch('/api/patient/booking'), fetch('/api/patient/booking/doctors')]);
    const bookingData = await bookingRes.json();
    const doctorData = await doctorRes.json();
    booking = bookingData.booking || {};
    doctors = doctorData.doctors || [];
    selectedDoctorId = booking.doctorId || doctors[0]?.id;
    summaryDoctorSelect.innerHTML = doctors.map((doctor) => `<option value="${doctor.id}">${doctor.name} - ${doctor.title} - INR ${doctor.consultationFee}</option>`).join('');
    if (selectedDoctorId) summaryDoctorSelect.value = selectedDoctorId;
    selectedDate = booking.date || null;
    selectedSlot = booking.time || null;
    syncSummary();
    await loadAvailability();
  }

  summaryDoctorSelect?.addEventListener('change', async () => {
    selectedDoctorId = summaryDoctorSelect.value;
    await fetch('/api/patient/booking/details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: selectedDoctorId }) });
    await loadAvailability();
    syncSummary();
  });

  document.getElementById('prev-month')?.addEventListener('click', async () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1); await loadAvailability(); });
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
    setMessage('Confirming appointment...');
    try {
      const response = await fetch('/api/patient/booking/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, time: selectedSlot }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not confirm booking.');
      window.location.href = data.redirectTo;
    } catch (error) {
      setMessage(error.message, 'error');
    }
  });
  documentUploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    documentUploadMessage.textContent = 'Uploading...';
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
    }
  });

  init().catch((error) => setMessage(error.message, 'error'));
})();
