(async function () {
  const form = document.getElementById('consultation-reason-form');
  const message = document.getElementById('book-reason-message');
  const field = document.getElementById('follow-up-visit-field');
  const referenceField = document.getElementById('follow-up-reference-field');
  const previous = form.elements.previousAppointmentId;
  const draftKey = 'sumohanConsultationDraft';
  let draft = null;
  try { draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); } catch (_) { /* Ignore an invalid old draft. */ }
  const query = new URLSearchParams(location.search);
  const service = draft?.service || query.get('service');
  if (service && [...form.elements.service.options].some(option => option.value === service)) form.elements.service.value = service;
  if (draft?.consultationType === 'FOLLOW_UP' || query.get('type') === 'follow-up') form.elements.consultationType.value = 'FOLLOW_UP';
  if (draft?.previousCaseReference) form.elements.previousCaseReference.value = draft.previousCaseReference;
  function syncType() {
    const followUp = form.elements.consultationType.value === 'FOLLOW_UP';
    field.hidden = !followUp;
    referenceField.hidden = !followUp;
    previous.required = followUp && !form.elements.previousCaseReference.value.trim();
    form.elements.previousCaseReference.required = followUp && !previous.value;
    previous.disabled = !followUp;
    previous.options[0].textContent = followUp ? 'Choose a previous consultation' : 'No previous consultation';
    if (!followUp) previous.value = '';
  }
  form.elements.consultationType.addEventListener('change', syncType);
  previous.addEventListener('change', syncType);
  form.elements.previousCaseReference.addEventListener('input', syncType);
  syncType();
  try {
    const [response, doctorsResponse] = await Promise.all([fetch('/api/patient/appointments'), fetch('/api/patient/booking/doctors')]);
    const [data, doctorsData] = await Promise.all([response.json(), doctorsResponse.json()]);
    if (!response.ok) throw new Error(data.message);
    if (!doctorsResponse.ok) throw new Error(doctorsData.message);
    const appointments = (data.appointments || []).filter(visit => visit.status !== 'CANCELLED' && new Date(visit.appointment_at) <= new Date());
    appointments.forEach(visit => {
      const option = document.createElement('option'); option.value = visit.id;
      option.textContent = `${new Date(visit.appointment_at).toLocaleDateString('en-IN')} · ${visit.service_type} · ${visit.doctor_name}`;
      previous.appendChild(option);
    });
    document.getElementById('booking-history-summary').textContent = `${appointments.length} previous consultation${appointments.length === 1 ? '' : 's'} available for follow-up.`;
    const doctors = doctorsData.doctors || [];
    doctors.forEach(doctor => {
      const option = document.createElement('option');
      option.value = doctor.id;
      option.textContent = doctor.name;
      form.elements.doctorId.appendChild(option);
    });
    const preferredName = String(draft?.doctorName || '').replace(/^Dr\.?\s*/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const preferredDoctor = doctors.find(doctor => String(doctor.name).replace(/^Dr\.?\s*/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase() === preferredName);
    const requestedDoctorId = query.get('doctor');
    if (preferredDoctor) form.elements.doctorId.value = preferredDoctor.id;
    else if (doctors.some(doctor => doctor.id === requestedDoctorId)) form.elements.doctorId.value = requestedDoctorId;
    syncType();
  } catch (error) { message.textContent = error.message || 'Please log in to book.'; }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/patient/booking/reason', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      sessionStorage.removeItem(draftKey);
      if (window.PatientShell?.navigate) await window.PatientShell.navigate(data.redirectTo);
      else location.href = data.redirectTo;
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  });
})();
