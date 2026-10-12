(function () {
  if (window.AuraDoctor) return;

  const {
    escapeHtml,
    fetchJson,
    formatDate,
  } = window.Aura;

  function appointmentStatusLabel(value) {
    const normalized = String(value || 'SCHEDULED').replaceAll('_', ' ');
    if (normalized === 'IN PROGRESS') return 'Ongoing Consultation';
    if (normalized === 'COMPLETED') return 'Completed Consultation';
    return 'Scheduled Consultation';
  }

  function appointmentViewModel(item) {
    const timeParts = String(item.time || '').split(' ');
    const status = String(item.status || 'SCHEDULED').toUpperCase();
    return {
      id: item.id,
      date: item.date || '',
      time: timeParts[0] || item.time || '',
      meridiem: timeParts[1] || '',
      patientName: item.patientName || 'Patient',
      serviceType: item.serviceType || 'Consultation',
      label: appointmentStatusLabel(status),
      isReadOnly: status === 'COMPLETED' || status === 'CANCELLED',
      canCancel: status !== 'COMPLETED' && status !== 'CANCELLED',
    };
  }

  function appointmentCard(item) {
    const model = appointmentViewModel(item);
    return `
      <article class="grid gap-4 md:grid-cols-[72px_1fr] md:items-stretch">
        <div class="pt-3 text-right text-lg font-extrabold leading-tight text-[#b0004a]">
          <span>${escapeHtml(model.time)}</span>
          <span class="block font-semibold text-[#5a4044]">${escapeHtml(model.meridiem)}</span>
        </div>
        <div class="grid gap-4 rounded-xl border-l-4 border-[#006a62] bg-[#e2fbf7] p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p class="font-bold text-[#006a62]">${escapeHtml(model.label)}</p>
            <h3 class="text-2xl font-extrabold text-[#000767]">${escapeHtml(model.patientName)}</h3>
            <p class="text-[#5a4044]">${[model.serviceType, model.date].filter(Boolean).map(escapeHtml).join(' - ')}</p>
          </div>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <a class="inline-flex items-center gap-2 rounded-full bg-[#006a62] px-4 py-2 font-bold text-white" href="/doctor/appointment-details.html?appointmentId=${encodeURIComponent(model.id)}">
              <span class="material-symbols-outlined text-lg">clinical_notes</span>
              ${model.isReadOnly ? 'View' : 'Attend'}
            </a>
            ${model.canCancel ? `<button class="inline-flex items-center gap-2 rounded-full border border-[#ba1a1a] bg-white px-4 py-2 font-bold text-[#ba1a1a]" data-cancel="${escapeHtml(model.id)}" type="button"><span class="material-symbols-outlined text-lg">event_busy</span>Cancel</button>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  function filterAppointments(items, activeTab, today) {
    if (activeTab === 'today') return items.filter((item) => item.date === today);
    if (activeTab === 'future') return items.filter((item) => item.date > today);
    return items.filter((item) => item.date < today);
  }

  function emptyAppointmentsLabel(activeTab) {
    if (activeTab === 'today') return 'No appointments today.';
    if (activeTab === 'future') return 'No future appointments for this month.';
    return 'No past appointments for this month.';
  }

  function updateAppointmentStatus(id, status) {
    return fetchJson(`/api/doctor/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  function patientAge(profile) {
    if (profile?.age) return `${profile.age} yrs`;
    const date = profile?.dateOfBirth || profile?.dob;
    if (!date) return '';
    const birth = new Date(date);
    if (Number.isNaN(birth.getTime())) return '';
    return `${Math.max(0, new Date().getFullYear() - birth.getFullYear())} yrs`;
  }

  function patientMeta(patient) {
    const profile = patient.profile || {};
    return [patientAge(profile), profile.gender || profile.sex, patient.phone || patient.email].filter(Boolean).join(' - ') || 'Patient details available';
  }

  function appointmentPatientCard(item) {
    const patient = item.patient || {};
    return `
      <article class="grid gap-4 rounded-xl border border-[#e3bdc3] bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p class="text-sm font-extrabold text-[#006a62]">${escapeHtml(item.date)} - ${escapeHtml(item.time || '')}</p>
          <h2 class="mt-1 text-2xl font-extrabold text-[#000767]">${escapeHtml(patient.name || 'Patient')}</h2>
          <p class="text-[#5a4044]">${escapeHtml(patientMeta(patient))}</p>
          <p class="mt-2 font-bold text-[#b0004a]">${escapeHtml(item.serviceType || 'Consultation')}</p>
        </div>
        <a class="inline-flex items-center justify-center gap-2 rounded-full bg-[#006a62] px-5 py-3 font-bold text-white" href="/doctor/appointment-details.html?appointmentId=${encodeURIComponent(item.appointmentId)}">
          <span class="material-symbols-outlined text-lg">badge</span>
          Open Patient Info
        </a>
      </article>
    `;
  }

  function searchPatientCard(patient) {
    return `
      <article class="aura-card aura-card--padded">
        <h2 class="text-2xl font-extrabold">${escapeHtml(patient.name)}</h2>
        <p class="mt-1 text-[#5a4044]">${[patient.phone, patient.email].filter(Boolean).map(escapeHtml).join(' - ') || '-'}</p>
        <p class="mt-3 font-bold text-[#006a62]">${escapeHtml(patient.concern || 'Not recorded')}</p>
      </article>
    `;
  }

  window.AuraDoctor = {
    appointmentCard,
    filterAppointments,
    emptyAppointmentsLabel,
    updateAppointmentStatus,
    appointmentPatientCard,
    searchPatientCard,
    api: {
      dashboard: () => fetchJson('/api/doctor/dashboard'),
      schedule: (date, month) => fetchJson(`/api/doctor/schedule?date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}`),
      patientLists: () => fetchJson('/api/doctor/patients/lists'),
      patientSearch: (query) => fetchJson(`/api/doctor/patients/search?q=${encodeURIComponent(query)}`),
    },
    formatPrescriptionDate: formatDate,
  };
})();
