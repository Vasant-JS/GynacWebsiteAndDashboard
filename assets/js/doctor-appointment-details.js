(function () {
  const reportsList = document.getElementById('doctor-uploaded-reports-list');
  const prescriptionsList = document.getElementById('doctor-prescriptions-list');
  const form = document.getElementById('doctor-prescription-form');
  const message = document.getElementById('doctor-prescription-message');
  const patientName = document.getElementById('appointment-patient-name');
  const patientContact = document.getElementById('appointment-patient-contact');
  const sessionTime = document.getElementById('appointment-session-time');
  const observationsInput = document.getElementById('consultation-observations');
  const actionsInput = document.getElementById('consultation-actions');
  const notesMessage = document.getElementById('consultation-notes-message');
  let context = null;

  function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function renderReports() {
    const docs = context?.documents || [];
    reportsList.innerHTML = docs.length ? docs.map((doc) => `<article class="rounded-lg border border-[#e3bdc3] p-4"><p class="text-sm font-bold text-[#b0004a]">${doc.document_type === 'OLD_PRESCRIPTION' ? 'Old Prescription' : 'Report'}</p><h4 class="font-bold">${doc.name}</h4><p class="text-[#5a4044]">${formatDate(doc.document_date || doc.created_at)}${doc.file_name ? ` - ${doc.file_name}` : ''}</p>${doc.file_name ? `<a class="mt-2 inline-flex rounded-lg border border-[#b0004a] px-3 py-2 font-bold text-[#b0004a]" href="/api/doctor/documents/${doc.id}/download">Download</a>` : ''}</article>`).join('') : '<p class="text-[#5a4044]">No uploaded reports or old prescriptions yet.</p>';
  }

  function renderPrescriptions() {
    const prescriptions = context?.prescriptions || [];
    prescriptionsList.innerHTML = prescriptions.length ? prescriptions.map((item) => {
      const med = item.medications?.[0] || {};
      return `<article class="rounded-lg border border-[#e3bdc3] p-4"><p class="text-sm font-bold text-[#b0004a]">${formatDate(item.created_at)}</p><h4 class="font-bold">${med.name || 'Prescription'}</h4><p class="text-[#5a4044]">${[med.dosage, med.frequency, med.duration].filter(Boolean).join(' - ') || item.status}</p>${item.instructions?.advice ? `<p class="mt-2">${item.instructions.advice}</p>` : ''}</article>`;
    }).join('') : '<p class="text-[#5a4044]">No prescriptions written yet.</p>';
  }

  async function loadContext() {
    const appointmentId = new URLSearchParams(window.location.search).get('appointmentId');
    const response = await fetch(`/api/doctor/appointment-context${appointmentId ? `?appointmentId=${encodeURIComponent(appointmentId)}` : ''}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load appointment.');
    context = data;
    patientName.textContent = data.patient.name || 'Patient';
    patientContact.textContent = data.patient.phone || data.patient.email || '-';
    sessionTime.textContent = formatDate(data.appointment.appointmentAt);
    observationsInput.value = data.appointment.notes?.observations || '';
    actionsInput.value = (data.appointment.notes?.recommendedActions || []).join(', ');
    renderReports();
    renderPrescriptions();
  }

  async function saveConsultation(status) {
    if (!context?.appointment?.id) return;
    notesMessage.textContent = status === 'COMPLETED' ? 'Saving and completing appointment...' : 'Saving notes...';
    const recommendedActions = (actionsInput.value || '').split(',').map((item) => item.trim()).filter(Boolean);
    try {
      const response = await fetch(`/api/doctor/appointments/${context.appointment.id}/notes`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observations: observationsInput.value, recommendedActions, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save notes.');
      context.appointment.notes = data.appointment.notes;
      context.appointment.status = data.appointment.status;
      notesMessage.textContent = status === 'COMPLETED' ? 'Appointment completed.' : 'Notes saved.';
    } catch (error) {
      notesMessage.textContent = error.message;
    }
  }

  document.getElementById('consultation-save-draft')?.addEventListener('click', () => saveConsultation(''));
  document.getElementById('consultation-save-notes')?.addEventListener('click', () => saveConsultation('IN_PROGRESS'));
  document.getElementById('appointment-mark-completed')?.addEventListener('click', () => saveConsultation('COMPLETED'));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = 'Saving prescription...';
    const formData = new FormData(form);
    const medication = { name: formData.get('name'), dosage: formData.get('dosage'), frequency: formData.get('frequency'), duration: formData.get('duration') };
    try {
      const response = await fetch('/api/doctor/prescriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: context.appointment.id, medications: [medication], advice: formData.get('advice'), followUpDate: formData.get('followUpDate') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save prescription.');
      context.prescriptions = [data.prescription, ...(context.prescriptions || [])];
      message.textContent = 'Prescription saved for patient.';
      form.reset();
      renderPrescriptions();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  loadContext().catch((error) => { reportsList.innerHTML = `<p class="text-[#ba1a1a]">${error.message}</p>`; });
})();
