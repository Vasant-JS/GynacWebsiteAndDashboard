(function () {
  const status = document.getElementById('appointment-detail-status');
  const recentReportsList = document.getElementById('recent-reports-list');
  const prescriptionsList = document.getElementById('doctor-prescriptions-list');
  const form = document.getElementById('doctor-prescription-form');
  const message = document.getElementById('doctor-prescription-message');
  const prescriptionRecordLabel = document.getElementById('prescription-record-label');
  const prescriptionPatientName = document.getElementById('prescription-patient-name');
  const prescriptionPatientMeta = document.getElementById('prescription-patient-meta');
  const prescriptionPatientBlood = document.getElementById('prescription-patient-blood');
  const prescriptionBookingStatus = document.getElementById('prescription-booking-status');
  const medicationRows = document.getElementById('prescription-medication-rows');
  const addMedicineRowButton = document.getElementById('add-medicine-row');
  const prescriptionDraftButton = document.getElementById('prescription-save-draft');
  const writtenPrescriptionName = document.getElementById('written-prescription-name');
  const writtenPrescriptionPhoto = document.getElementById('written-prescription-photo');
  const uploadWrittenPrescription = document.getElementById('upload-written-prescription');
  const writtenPrescriptionMessage = document.getElementById('written-prescription-message');
  const patientName = document.getElementById('appointment-patient-name');
  const patientStatus = document.getElementById('appointment-patient-status');
  const patientDemographics = document.getElementById('appointment-patient-demographics');
  const patientContact = document.getElementById('appointment-patient-contact');
  const patientLastVisit = document.getElementById('appointment-last-visit');
  const patientBloodType = document.getElementById('appointment-blood-type');
  const emailLink = document.getElementById('appointment-email-link');
  const phoneLink = document.getElementById('appointment-phone-link');
  const sessionDate = document.getElementById('appointment-session-date');
  const sessionTime = document.getElementById('appointment-session-time');
  const serviceType = document.getElementById('appointment-service-type');
  const actionsList = document.getElementById('appointment-actions-list');
  const caseTitle = document.getElementById('case-title');
  const caseDate = document.getElementById('case-date');
  const caseSummary = document.getElementById('case-summary');
  const observationsInput = document.getElementById('consultation-observations');
  const actionsInput = document.getElementById('consultation-actions');
  const notesMessage = document.getElementById('consultation-notes-message');
  const markCompletedButton = document.getElementById('appointment-mark-completed');
  const tabButtons = Array.from(document.querySelectorAll('[data-detail-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-detail-panel]'));
  let context = null;
  let prescriptionFormHydrated = false;

  function loadingMarkup(label) {
    return `<div class="aura-loading rounded-lg border border-[#e3bdc3] p-4"><span class="aura-spinner" aria-hidden="true"></span><span>${label}</span></div>`;
  }

  function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', options).format(new Date(value));
  }

  function setText(node, value) {
    if (node) node.textContent = value || '-';
  }

  function setActionLink(link, href, disabledTitle) {
    if (!link) return;
    if (href) {
      link.href = href;
      link.title = '';
      link.removeAttribute('aria-disabled');
      link.classList.remove('pointer-events-none', 'opacity-50');
      return;
    }
    link.href = '#';
    link.title = disabledTitle;
    link.setAttribute('aria-disabled', 'true');
    link.classList.add('pointer-events-none', 'opacity-50');
  }

  function escapeAttr(value) {
    return String(value || '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  function patientAge(profile) {
    if (profile?.age) return `${profile.age} Years`;
    if (!profile?.dateOfBirth && !profile?.dob) return null;
    const birth = new Date(profile.dateOfBirth || profile.dob);
    if (Number.isNaN(birth.getTime())) return null;
    const age = Math.max(0, new Date().getFullYear() - birth.getFullYear());
    return `${age} Years`;
  }

  function documentTypeLabel(doc) {
    if (doc.metadata?.uploadedDuring === 'doctor_prescription_builder') return 'Prescription Photo';
    return doc.document_type === 'OLD_PRESCRIPTION' ? 'Old Prescription' : 'Report';
  }

  function switchTab(name) {
    tabButtons.forEach((button) => {
      const active = button.dataset.detailTab === name;
      button.classList.toggle('active-tab', active);
      button.classList.toggle('text-[#5a4044]', !active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.detailPanel !== name));
  }

  function reportCard(doc) {
    return `
      <article class="rounded-lg border border-[#e3bdc3] p-4">
        <p class="text-sm font-bold text-[#b0004a]">${documentTypeLabel(doc)}</p>
        <h4 class="font-bold">${doc.name}</h4>
        <p class="text-[#5a4044]">${formatDate(doc.document_date || doc.created_at)}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a class="inline-flex items-center gap-2 rounded-lg border border-[#006a62] px-3 py-2 text-sm font-bold text-[#006a62]" href="/api/doctor/documents/${doc.id}/view" target="_blank" rel="noopener">
            <span class="material-symbols-outlined text-base">visibility</span>View
          </a>
          <a class="inline-flex items-center gap-2 rounded-lg border border-[#b0004a] px-3 py-2 text-sm font-bold text-[#b0004a]" href="/api/doctor/documents/${doc.id}/download">
            <span class="material-symbols-outlined text-base">download</span>Download
          </a>
        </div>
      </article>
    `;
  }

  function renderReports() {
    const docs = context?.documents || [];
    recentReportsList.innerHTML = docs.map((doc) => `
      <div class="grid gap-3 px-5 py-4">
        <div>
          <p class="text-sm font-extrabold">${doc.name}</p>
          <p class="text-xs text-[#5a4044]">${documentTypeLabel(doc)} - ${formatDate(doc.document_date || doc.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="inline-flex items-center gap-1 rounded-lg border border-[#006a62] px-3 py-2 text-xs font-extrabold text-[#006a62]" href="/api/doctor/documents/${doc.id}/view" target="_blank" rel="noopener">
            <span class="material-symbols-outlined text-sm">visibility</span>View
          </a>
          <a class="inline-flex items-center gap-1 rounded-lg border border-[#b0004a] px-3 py-2 text-xs font-extrabold text-[#b0004a]" href="/api/doctor/documents/${doc.id}/download">
            <span class="material-symbols-outlined text-sm">download</span>Download
          </a>
        </div>
      </div>
    `).join('') || '<p class="px-5 py-4 text-sm text-[#5a4044]">No uploaded reports.</p>';
  }

  function renderPrescriptions() {
    const prescriptions = context?.prescriptions || [];
    prescriptionsList.innerHTML = prescriptions.length ? prescriptions.map((item) => {
      const med = item.medications?.[0] || {};
      const service = item.metadata?.appointment?.serviceType;
      const followUp = item.instructions?.followUpDate ? `Follow-up: ${item.instructions.followUpDate}` : '';
      return `<article class="rounded-lg border border-[#e3bdc3] p-4"><p class="text-sm font-bold text-[#b0004a]">${formatDate(item.created_at)}</p><h4 class="font-bold">${med.name || service || 'Prescription'}</h4><p class="mt-1 inline-flex rounded-full bg-[#edecff] px-3 py-1 text-xs font-extrabold">${item.status}</p><p class="mt-2 text-[#5a4044]">${[med.dosage, med.frequency, med.duration].filter(Boolean).join(' - ') || service || item.status}</p>${item.instructions?.advice ? `<p class="mt-2">${item.instructions.advice}</p>` : ''}${followUp ? `<p class="mt-2 text-sm font-bold text-[#006a62]">${followUp}</p>` : ''}</article>`;
    }).join('') : '<p class="text-[#5a4044]">No prescriptions written yet.</p>';
  }

  function medicationRowTemplate(values = {}) {
    return `
      <tr data-medication-row>
        <td class="px-4 py-3">
          <input class="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 focus:border-[#b0004a] focus:bg-white focus:outline-none" data-medication-field="name" placeholder="Medicine" value="${escapeAttr(values.name)}" required>
        </td>
        <td class="px-4 py-3">
          <input class="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 focus:border-[#b0004a] focus:bg-white focus:outline-none" data-medication-field="dosage" placeholder="Dosage" value="${escapeAttr(values.dosage)}">
        </td>
        <td class="px-4 py-3">
          <select class="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 focus:border-[#b0004a] focus:bg-white focus:outline-none" data-medication-field="frequency">
            ${['', 'Once daily', 'Twice daily', 'Three times daily', 'After meals', 'Before meals', 'As needed'].map((option) => `<option value="${option}" ${values.frequency === option ? 'selected' : ''}>${option || 'Frequency'}</option>`).join('')}
          </select>
        </td>
        <td class="px-4 py-3">
          <input class="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 focus:border-[#b0004a] focus:bg-white focus:outline-none" data-medication-field="duration" placeholder="Duration" value="${escapeAttr(values.duration)}">
        </td>
        <td class="px-4 py-3">
          <input class="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 focus:border-[#b0004a] focus:bg-white focus:outline-none" data-medication-field="instructions" placeholder="Instructions" value="${escapeAttr(values.instructions)}">
        </td>
        <td class="px-4 py-3">
          <button class="grid h-9 w-9 place-items-center rounded-lg text-[#ba1a1a]" data-remove-medication type="button" title="Remove medicine">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </td>
      </tr>
    `;
  }

  function ensureMedicationRows() {
    if (!medicationRows || medicationRows.children.length) return;
    medicationRows.insertAdjacentHTML('beforeend', medicationRowTemplate());
  }

  function collectMedications() {
    return Array.from(medicationRows?.querySelectorAll('[data-medication-row]') || [])
      .map((row) => {
        const medicine = {};
        row.querySelectorAll('[data-medication-field]').forEach((field) => {
          medicine[field.dataset.medicationField] = field.value.trim();
        });
        return medicine;
      })
      .filter((medicine) => medicine.name || medicine.dosage || medicine.frequency || medicine.duration || medicine.instructions);
  }

  function hydratePrescriptionDraft() {
    if (prescriptionFormHydrated || !form || !medicationRows) return;
    const draft = (context?.prescriptions || []).find((item) => String(item.status || '').toUpperCase() === 'DRAFT');
    if (!draft) return;
    medicationRows.innerHTML = '';
    const medications = Array.isArray(draft.medications) && draft.medications.length ? draft.medications : [{}];
    medications.forEach((medicine) => medicationRows.insertAdjacentHTML('beforeend', medicationRowTemplate(medicine)));
    const adviceInput = form.elements.advice;
    const followUpInput = form.elements.followUpDate;
    if (adviceInput) adviceInput.value = draft.instructions?.advice || '';
    if (followUpInput) followUpInput.value = draft.instructions?.followUpDate || '';
    prescriptionFormHydrated = true;
  }

  function renderActions(actions) {
    actionsList.innerHTML = actions.length ? actions.map((item) => `
      <p class="flex items-center gap-2 text-sm">
        <span class="material-symbols-outlined text-[#006a62]">check_circle</span>
        <span>${item}</span>
      </p>
    `).join('') : '<p class="text-sm text-[#5a4044]">No recommended actions saved.</p>';
  }

  function renderContext() {
    const patient = context.patient || {};
    const profile = patient.profile || {};
    const appointment = context.appointment || {};
    const notes = appointment.notes || {};
    const recommendedActions = Array.isArray(notes.recommendedActions) ? notes.recommendedActions : [];
    const ageGender = [patientAge(profile), profile.gender || profile.sex].filter(Boolean).join(' / ');
    const isCompleted = String(appointment.status || '').toUpperCase() === 'COMPLETED';

    setText(status, 'Connected to PostgreSQL');
    setText(patientName, patient.name || 'Patient');
    setText(patientStatus, appointment.status ? appointment.status.replaceAll('_', ' ') : 'Active Patient');
    setText(patientDemographics, ageGender || '-');
    setText(patientContact, patient.phone || patient.email || '-');
    setText(patientLastVisit, formatDate(appointment.appointmentAt, { dateStyle: 'medium' }));
    setText(patientBloodType, profile.bloodType || profile.blood_type || profile.bloodGroup || '-');
    setText(prescriptionRecordLabel, `Creating digital record for Patient ${patient.id ? `#${String(patient.id).slice(0, 8)}` : ''}`);
    setText(prescriptionPatientName, patient.name || 'Patient');
    setText(prescriptionPatientMeta, [ageGender, patient.phone || patient.email].filter(Boolean).join(' - ') || '-');
    setText(prescriptionPatientBlood, profile.bloodType || profile.blood_type || profile.bloodGroup || '-');
    setText(prescriptionBookingStatus, appointment.status ? appointment.status.replaceAll('_', ' ') : 'Booked');
    setText(sessionDate, formatDate(appointment.appointmentAt, { dateStyle: 'long' }));
    setText(sessionTime, formatDate(appointment.appointmentAt, { timeStyle: 'short' }));
    setText(serviceType, appointment.serviceType || 'Consultation');
    setText(caseTitle, appointment.serviceType || 'Consultation Summary');
    setText(caseDate, formatDate(appointment.appointmentAt, { dateStyle: 'medium' }));
    setText(caseSummary, notes.observations || 'No previous consultation notes recorded in the database.');
    observationsInput.value = notes.observations || '';
    actionsInput.value = recommendedActions.join(', ');

    setActionLink(emailLink, patient.email ? `mailto:${patient.email}` : '', 'Email is not available for this patient');
    setActionLink(phoneLink, patient.whatsappNumber || patient.phone ? `tel:${patient.whatsappNumber || patient.phone}` : '', 'Phone number is not available for this patient');
    if (markCompletedButton) {
      markCompletedButton.disabled = isCompleted;
      markCompletedButton.classList.toggle('opacity-70', isCompleted);
      markCompletedButton.classList.toggle('cursor-not-allowed', isCompleted);
      markCompletedButton.innerHTML = `<span class="material-symbols-outlined">task_alt</span>${isCompleted ? 'Completed' : 'Mark as Completed'}`;
    }
    renderActions(recommendedActions);
    renderReports();
    renderPrescriptions();
    ensureMedicationRows();
    hydratePrescriptionDraft();
  }

  async function loadContext() {
    prescriptionsList.innerHTML = loadingMarkup('Loading prescriptions...');
    recentReportsList.innerHTML = loadingMarkup('Loading uploaded reports...');
    const appointmentId = new URLSearchParams(window.location.search).get('appointmentId');
    const response = await fetch(`/api/doctor/appointment-context${appointmentId ? `?appointmentId=${encodeURIComponent(appointmentId)}` : ''}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load appointment.');
    context = data;
    renderContext();
  }

  async function saveConsultation(statusValue) {
    if (!context?.appointment?.id) return;
    const currentStatus = String(context.appointment.status || '').toUpperCase();
    if (currentStatus === 'COMPLETED' && statusValue === 'COMPLETED') {
      notesMessage.textContent = 'Appointment is already completed.';
      return;
    }
    const nextStatus = currentStatus === 'COMPLETED' && statusValue === 'IN_PROGRESS' ? '' : statusValue;
    notesMessage.innerHTML = `<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>${nextStatus === 'COMPLETED' ? 'Saving and completing appointment...' : 'Saving notes...'}</span></span>`;
    const recommendedActions = (actionsInput.value || '').split(',').map((item) => item.trim()).filter(Boolean);
    try {
      const response = await fetch(`/api/doctor/appointments/${context.appointment.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: observationsInput.value, recommendedActions, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save notes.');
      context.appointment.notes = data.appointment.notes;
      context.appointment.status = data.appointment.status;
      renderContext();
      notesMessage.textContent = nextStatus === 'COMPLETED' ? 'Appointment completed.' : 'Notes saved.';
    } catch (error) {
      notesMessage.textContent = error.message;
    }
  }

  tabButtons.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.detailTab)));
  document.getElementById('consultation-save-draft')?.addEventListener('click', () => saveConsultation(''));
  document.getElementById('consultation-save-notes')?.addEventListener('click', () => saveConsultation('IN_PROGRESS'));
  markCompletedButton?.addEventListener('click', () => saveConsultation('COMPLETED'));
  addMedicineRowButton?.addEventListener('click', () => medicationRows?.insertAdjacentHTML('beforeend', medicationRowTemplate()));
  medicationRows?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-medication]');
    if (!removeButton) return;
    const rows = medicationRows.querySelectorAll('[data-medication-row]');
    if (rows.length <= 1) {
      rows[0]?.querySelectorAll('input, select').forEach((field) => {
        field.value = '';
      });
      return;
    }
    removeButton.closest('[data-medication-row]')?.remove();
  });
  async function savePrescription(statusValue) {
    if (!context?.appointment?.id) return;
    const statusValueUpper = String(statusValue || 'FINAL').toUpperCase();
    message.innerHTML = `<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>${statusValueUpper === 'DRAFT' ? 'Saving draft...' : 'Saving prescription...'}</span></span>`;
    const formData = new FormData(form);
    const medications = collectMedications();
    if (statusValueUpper === 'FINAL' && !medications.length) {
      message.textContent = 'Add at least one medicine before saving.';
      return;
    }
    try {
      const response = await fetch('/api/doctor/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: context.appointment.id, status: statusValueUpper, medications, advice: formData.get('advice'), followUpDate: formData.get('followUpDate') }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save prescription.');
      context.prescriptions = [data.prescription, ...(context.prescriptions || [])];
      message.textContent = statusValueUpper === 'DRAFT' ? 'Draft saved to database.' : 'Prescription saved for patient.';
      if (statusValueUpper === 'FINAL') {
        form.reset();
        medicationRows.innerHTML = '';
        prescriptionFormHydrated = true;
        ensureMedicationRows();
      }
      renderPrescriptions();
    } catch (error) {
      message.textContent = error.message;
    }
  }

  prescriptionDraftButton?.addEventListener('click', () => savePrescription('DRAFT'));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await savePrescription('FINAL');
  });
  uploadWrittenPrescription?.addEventListener('click', async () => {
    if (!context?.appointment?.id) return;
    const file = writtenPrescriptionPhoto?.files?.[0];
    if (!file) {
      writtenPrescriptionMessage.textContent = 'Choose a prescription photo first.';
      return;
    }
    writtenPrescriptionMessage.innerHTML = '<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>Uploading prescription photo...</span></span>';
    const payload = new FormData();
    payload.append('file', file);
    payload.append('name', writtenPrescriptionName?.value || 'Written Prescription Photo');
    payload.append('documentDate', new Date().toISOString().slice(0, 10));
    try {
      const response = await fetch(`/api/doctor/appointments/${context.appointment.id}/prescription-photo`, {
        method: 'POST',
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to upload prescription photo.');
      context.documents = [data.document, ...(context.documents || [])];
      renderReports();
      writtenPrescriptionPhoto.value = '';
      writtenPrescriptionMessage.textContent = 'Prescription photo uploaded to patient documents.';
    } catch (error) {
      writtenPrescriptionMessage.textContent = error.message;
    }
  });

  ensureMedicationRows();
  loadContext().catch((error) => {
    status.textContent = error.message;
    recentReportsList.innerHTML = `<p class="px-5 py-4 text-sm text-[#ba1a1a]">${error.message}</p>`;
  });
})();
