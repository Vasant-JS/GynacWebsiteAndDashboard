(function () {
  const status = document.getElementById('patient-status');
  const title = document.getElementById('patient-title');
  const summary = document.getElementById('patient-summary');
  const upcoming = document.getElementById('upcoming-card');
  const prescriptions = document.getElementById('patient-prescriptions-list');
  const reports = document.getElementById('patient-reports-list');
  const history = document.getElementById('patient-history-list');

  function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', options).format(new Date(value));
  }

  function emptyCard(message) {
    return `<p class="text-on-surface-variant font-body-md text-body-md">${message}</p>`;
  }

  function loadingMarkup(label) {
    return `<div class="aura-loading rounded-xl bg-white p-4"><span class="aura-spinner" aria-hidden="true"></span><span>${label}</span></div>`;
  }

  function loadingRow(label) {
    return `<tr><td class="px-gutter py-4" colspan="5"><div class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>${label}</span></div></td></tr>`;
  }

  function statusPill(value) {
    const statusValue = String(value || 'UNKNOWN').replaceAll('_', ' ');
    const isCancelled = statusValue === 'CANCELLED';
    return `<span class="px-3 py-1 rounded-full ${isCancelled ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-on-surface-variant'} font-label-sm text-label-sm">${statusValue}</span>`;
  }

  function renderUpcoming(item) {
    if (!item) {
      upcoming.innerHTML = `
        <span class="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-sm text-label-sm uppercase tracking-wider">Upcoming Appointment</span>
        <h3 class="text-on-surface font-headline-md text-headline-md mt-base">No upcoming appointments</h3>
        <p class="mt-base text-on-surface-variant font-body-md text-body-md">Book a consultation when you are ready.</p>
      `;
      return;
    }

    upcoming.innerHTML = `
      <div class="flex flex-wrap justify-between gap-gutter mb-gutter">
        <div>
          <span class="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-sm text-label-sm uppercase tracking-wider">Upcoming Appointment</span>
          <h3 class="text-on-surface font-headline-md text-headline-md mt-base">${item.doctor_name || 'Doctor not assigned'}</h3>
          <p class="text-on-surface-variant font-body-md text-body-md">${item.service_type || 'Consultation'}</p>
        </div>
        <div class="text-left md:text-right">
          <p class="text-primary font-headline-md text-headline-md">${formatDate(item.appointment_at, { dateStyle: 'medium' })}</p>
          <p class="text-on-surface-variant font-label-md text-label-md">${formatDate(item.appointment_at, { timeStyle: 'short' })}</p>
        </div>
      </div>
      <div class="flex gap-gutter items-center p-base bg-surface-container-low rounded-lg">
        <span class="material-symbols-outlined text-secondary" data-icon="location_on">location_on</span>
        <span class="text-on-surface font-body-md text-body-md">${item.location || 'Location to be confirmed'}</span>
      </div>
      <div class="mt-gutter flex flex-wrap gap-base">
        <a class="bg-primary text-on-primary px-6 py-2 rounded-lg font-label-md text-label-md" href="/patient/appointments.html">View Appointment</a>
        ${item.metadata?.virtualMeeting?.meetLink ? `<a class="border border-outline text-on-surface-variant px-6 py-2 rounded-lg font-label-md text-label-md" href="${item.metadata.virtualMeeting.meetLink}" target="_blank">Meet Link</a>` : ''}
      </div>
    `;
  }

  function renderPrescriptions(items) {
    prescriptions.innerHTML = items.length ? items.map((item) => {
      const med = item.medications?.[0] || {};
      return `
        <article class="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div class="flex items-center gap-base">
            <div class="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center">
              <span class="material-symbols-outlined text-on-secondary-container" data-icon="medication">medication</span>
            </div>
            <div>
              <p class="text-on-surface font-label-md text-label-md">${med.name || 'Prescription'}</p>
              <p class="text-on-surface-variant font-body-sm text-body-sm">${[med.dosage, med.frequency, med.duration].filter(Boolean).join(' - ') || item.status || formatDate(item.created_at)}</p>
            </div>
          </div>
        </article>
      `;
    }).join('') : emptyCard('No prescriptions found in the database.');
  }

  function renderReports(items) {
    reports.innerHTML = items.length ? items.map((item) => `
      <article class="flex items-center justify-between p-4 bg-surface rounded-lg">
        <div class="flex items-center gap-base">
          <div class="w-10 h-10 bg-tertiary-fixed rounded-full flex items-center justify-center">
            <span class="material-symbols-outlined text-on-tertiary-fixed" data-icon="lab_research">lab_research</span>
          </div>
          <div>
            <p class="text-on-surface font-label-md text-label-md">${item.name}</p>
            <p class="text-on-surface-variant font-body-sm text-body-sm">${item.document_date || item.status || formatDate(item.created_at)}</p>
          </div>
        </div>
        ${item.file_name ? `<a class="text-primary font-label-sm text-label-sm" href="/api/patient/documents/${item.id}/download">Download</a>` : ''}
      </article>
    `).join('') : emptyCard('No reports found in the database.');
  }

  function renderHistory(items) {
    history.innerHTML = items.length ? items.map((item) => `
      <tr>
        <td class="px-gutter py-4 font-body-md text-on-surface">${item.service_type || '-'}</td>
        <td class="px-gutter py-4 font-body-md text-on-surface">${item.doctor_name || '-'}</td>
        <td class="px-gutter py-4 font-body-md text-on-surface-variant">${formatDate(item.appointment_at)}</td>
        <td class="px-gutter py-4">${statusPill(item.status)}</td>
        <td class="px-gutter py-4">
          <a class="text-primary font-label-md text-label-md hover:underline" href="/patient/appointments.html">View Details</a>
        </td>
      </tr>
    `).join('') : '<tr><td class="px-gutter py-4 font-body-md text-on-surface-variant" colspan="5">No appointment history found in the database.</td></tr>';
  }

  async function load() {
    try {
      upcoming.innerHTML = loadingMarkup('Loading upcoming appointment...');
      prescriptions.innerHTML = loadingMarkup('Loading prescriptions...');
      reports.innerHTML = loadingMarkup('Loading reports...');
      history.innerHTML = loadingRow('Loading appointment history...');
      const response = await fetch('/api/patient/dashboard');
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = `/patient/login.html?next=${encodeURIComponent('/patient/dashboard.html')}`;
        return;
      }
      if (!response.ok) throw new Error(data.message || 'Unable to load dashboard.');

      status.textContent = 'Connected to PostgreSQL';
      title.textContent = `Hello, ${data.patient.name}`;
      summary.textContent = 'Your dashboard is showing records from the database.';

      renderUpcoming(data.upcoming);
      renderPrescriptions(data.prescriptions || []);
      renderReports(data.reports || []);
      renderHistory(data.history || []);
    } catch (error) {
      status.textContent = error.message;
      summary.textContent = 'We could not load your patient record. Please login again if the issue continues.';
      upcoming.innerHTML = '<h3 class="text-2xl font-extrabold">Unable to load dashboard</h3><p class="text-[#5a4044]">Please refresh once or login again.</p>';
      prescriptions.innerHTML = emptyCard('No prescriptions loaded.');
      reports.innerHTML = emptyCard('No reports loaded.');
      history.innerHTML = '<tr><td class="px-gutter py-4 font-body-md text-on-surface-variant" colspan="5">No appointment history loaded.</td></tr>';
    }
  }

  load();
})();
