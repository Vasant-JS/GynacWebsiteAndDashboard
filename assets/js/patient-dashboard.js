(function () {
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const dateFormat = (value, options) => value ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(new Date(value)) : '—';
  const dateOnly = (value) => value ? dateFormat(value, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const dateTime = (value) => value ? dateFormat(value, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const empty = (message) => `<p class="patient-empty">${escapeHtml(message)}</p>`;
  const statusLabel = (value) => String(value || 'Scheduled').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

  function setText(id, value) { const node = $(id); if (node) node.textContent = value; }
  function setOptional(id, value) { const node = $(id); if (node) { node.hidden = !value; if (value) node.textContent = value; } }

  function renderPatient(patient) {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    setText('patient-title', `${greeting}, ${patient.name || 'Patient'}`);
    setText('patient-case-id', patient.id ? `Case ID: SC-${patient.id}` : 'Patient record');
    setOptional('patient-location', patient.profile?.city ? `${patient.profile.city}${patient.profile.country ? `, ${patient.profile.country}` : ''}` : patient.profile?.permanentAddress || '');
    setOptional('patient-blood-group', patient.profile?.bloodGroup ? `Blood group: ${patient.profile.bloodGroup}` : '');
    window.PatientShell?.setPatient(patient);
  }

  function renderMetrics(data) {
    const stats = data.appointmentStats || {};
    setText('metric-next', data.upcoming ? dateOnly(data.upcoming.appointment_at) : 'None booked');
    setText('metric-next-detail', data.upcoming ? dateFormat(data.upcoming.appointment_at, { timeStyle: 'short' }) + ' IST' : 'Book when you are ready');
    setText('metric-upcoming', String(stats.upcoming_count ?? 0));
    setText('metric-upcoming-detail', Number(stats.upcoming_count) === 1 ? 'Scheduled consultation' : 'Scheduled consultations');
    setText('metric-completed', String(stats.completed_count ?? 0));
    setText('metric-last', stats.last_visit_at ? dateOnly(stats.last_visit_at) : 'No past booking');
    setText('metric-last-detail', Number(stats.past_count) ? `${stats.past_count} past ${Number(stats.past_count) === 1 ? 'booking' : 'bookings'}` : 'Your appointment history');
    setText('patient-plan-summary', data.upcoming
      ? `Your next consultation is on ${dateTime(data.upcoming.appointment_at)} IST${data.upcoming.doctor_name ? ` with ${data.upcoming.doctor_name}` : ''}. You can review or manage it from Visits.`
      : Number(stats.past_count) ? 'You have no upcoming consultation. Your past bookings remain available in Visits, and you can book a follow-up when needed.'
        : 'You have no upcoming consultation yet. Book a visit to start your care journey.');
    const bookingLink = $('patient-plan-book-link');
    if (bookingLink && Number(stats.past_count)) {
      bookingLink.href = '/patient/book-reason.html?type=follow-up';
      bookingLink.innerHTML = 'Book a follow-up <span aria-hidden="true">→</span>';
    }
  }

  function renderUpcoming(item) {
    if (!item) {
      $('upcoming-card').innerHTML = empty('No upcoming appointment. Book a consultation when you are ready.');
      return;
    }
    const meeting = item.metadata?.virtualMeeting;
    const safeMeeting = meeting?.meetLink || meeting?.calendarEventId ? `/api/consultations/${encodeURIComponent(item.id)}/join?role=PATIENT` : null;
    const isClosed = item.status === 'COMPLETED' || item.status === 'CANCELLED';
    $('upcoming-card').innerHTML = `
      <div class="patient-upcoming"><div class="patient-upcoming__main"><span class="patient-upcoming__icon material-symbols-outlined" aria-hidden="true">stethoscope</span><div><h3>${escapeHtml(item.doctor_name || 'Doctor to be assigned')}</h3><p>${escapeHtml(item.service_type || 'Consultation')}</p><p class="patient-upcoming__date">${escapeHtml(dateTime(item.appointment_at))} IST</p><p>${escapeHtml(item.location || 'Location to be confirmed')}</p><span class="patient-badge">${escapeHtml(statusLabel(item.status))}</span></div></div></div>
      <div class="patient-upcoming__actions"><a href="/patient/appointments.html">View appointment</a>${safeMeeting ? isClosed ? '<button type="button" disabled title="Google Meet is unavailable for completed or cancelled appointments">Join Google Meet</button>' : `<a href="${escapeHtml(safeMeeting)}" target="_blank" rel="noopener noreferrer">Join Google Meet</a>` : ''}</div>`;
  }

  function renderPrescriptions(items) {
    const list = Array.isArray(items) ? items : [];
    $('patient-prescriptions-list').innerHTML = list.length ? list.slice(0, 2).map((item) => {
      const medication = Array.isArray(item.medications) ? item.medications[0] || {} : {};
      const details = [medication.dosage, medication.frequency, medication.duration].filter(Boolean);
      return `<article class="patient-prescription"><span class="patient-badge patient-badge--muted">${escapeHtml(statusLabel(item.status || 'Prescription'))}</span><h3>${escapeHtml(medication.name || 'Prescription')}</h3>${details.length ? details.map((detail) => `<p>${escapeHtml(detail)}</p>`).join('') : `<p>Issued ${escapeHtml(dateOnly(item.created_at))}</p>`}</article>`;
    }).join('') : empty('No prescriptions available yet.');
  }

  function renderHistory(items) {
    const list = Array.isArray(items) ? items : [];
    $('patient-history-list').innerHTML = list.length ? list.slice(0, 3).map((item) => `
      <article class="patient-visit"><span class="patient-visit__date">${escapeHtml(dateFormat(item.appointment_at, { day: '2-digit', month: 'short' }))}</span><div class="patient-visit__body"><h3>${escapeHtml(item.service_type || 'Consultation')}</h3><p>${escapeHtml(item.doctor_name || 'Doctor not assigned')} · ${escapeHtml(dateTime(item.appointment_at))} IST</p></div><div class="patient-visit__end"><span class="patient-badge patient-badge--muted">${escapeHtml(statusLabel(item.status))}</span><a href="/patient/appointments.html?tab=past">View details →</a></div></article>`).join('') : empty('No previous appointments to show.');
  }

  function renderReports(items) {
    const list = Array.isArray(items) ? items : [];
    $('patient-reports-list').innerHTML = list.length ? list.slice(0, 3).map((item) => `
      <article class="patient-report"><span class="material-symbols-outlined" aria-hidden="true">description</span><div><strong>${escapeHtml(item.name || 'Medical document')}</strong><small>${escapeHtml(item.document_date || dateOnly(item.created_at))} · ${escapeHtml(item.document_type === 'OLD_PRESCRIPTION' ? 'Uploaded prescription' : 'Report')}</small></div>${item.file_name ? `<a href="/api/patient/documents/${encodeURIComponent(item.id)}/download" aria-label="Download ${escapeHtml(item.name || 'document')}">Download</a>` : ''}</article>`).join('') : empty('No reports uploaded yet.');
  }

  async function load() {
    try {
      const response = await fetch('/api/patient/dashboard');
      if (response.status === 401) {
        window.location.href = `/patient/login.html?next=${encodeURIComponent('/patient/dashboard.html')}`;
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load your dashboard.');
      setText('patient-status', 'Your care overview');
      setText('patient-summary', 'Review your appointments, prescriptions and documents below.');
      renderPatient(data.patient || {});
      renderMetrics(data);
      renderUpcoming(data.upcoming);
      renderPrescriptions(data.prescriptions);
      renderHistory(data.history);
      renderReports(data.reports);
    } catch (error) {
      setText('patient-status', error.message);
      setText('patient-summary', 'We could not load your care records. Please refresh or sign in again.');
      $('upcoming-card').innerHTML = empty('Appointment information is unavailable.');
      $('patient-prescriptions-list').innerHTML = empty('Prescriptions could not be loaded.');
      $('patient-history-list').innerHTML = empty('Visit history could not be loaded.');
      $('patient-reports-list').innerHTML = empty('Reports could not be loaded.');
      setText('patient-plan-summary', 'Appointment information is unavailable right now.');
    }
  }

  load();
})();
