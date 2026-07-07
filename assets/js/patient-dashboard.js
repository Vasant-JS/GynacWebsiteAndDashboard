(function () {
  const status = document.getElementById('patient-status');
  const title = document.getElementById('patient-title');
  const upcoming = document.getElementById('upcoming-card');
  const prescriptions = document.getElementById('patient-prescriptions-list');
  const reports = document.getElementById('patient-reports-list');

  function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
  }

  async function load() {
    try {
      const response = await fetch('/api/patient/dashboard');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load dashboard.');
      status.textContent = 'Connected to PostgreSQL';
      title.textContent = `Welcome, ${data.patient.name}`;
      if (data.upcoming) {
        upcoming.innerHTML = `
          <p class="text-sm font-extrabold text-[#006a62]">UPCOMING APPOINTMENT</p>
          <h3 class="mt-3 text-2xl font-extrabold">${data.upcoming.service_type}</h3>
          <p class="mt-1 text-[#5a4044]">${data.upcoming.doctor_name || '-'} • ${formatDate(data.upcoming.appointment_at)}</p>
          <p class="mt-2 text-[#5a4044]">${data.upcoming.location || '-'}</p>
          <div class="mt-5 flex flex-wrap gap-3">
            <a class="rounded-lg bg-[#b0004a] px-5 py-3 font-bold text-white" href="/patient/book-reason.html">Book New Visit</a>
            ${data.upcoming.metadata?.virtualMeeting?.meetLink ? `<a class="rounded-lg border border-[#000767] px-5 py-3 font-bold text-[#000767]" href="${data.upcoming.metadata.virtualMeeting.meetLink}" target="_blank">Meet Link</a>` : ''}
          </div>
        `;
      } else {
        upcoming.innerHTML = '<h3 class="text-2xl font-extrabold">No upcoming appointments</h3><a class="mt-5 inline-flex rounded-lg bg-[#b0004a] px-5 py-3 font-bold text-white" href="/patient/book-reason.html">Book New Consultation</a>';
      }
      prescriptions.innerHTML = data.prescriptions.length ? data.prescriptions.map((item) => {
        const med = item.medications?.[0] || {};
        return `<article class="rounded-xl border border-[#e3bdc3] bg-white p-4"><h4 class="font-extrabold">${med.name || 'Prescription'}</h4><p class="text-[#5a4044]">${[med.dosage, med.frequency, med.duration].filter(Boolean).join(' • ') || item.status}</p></article>`;
      }).join('') : '<p class="text-[#5a4044]">No prescriptions yet.</p>';
      reports.innerHTML = data.reports.length ? data.reports.map((item) => `<article class="rounded-xl border border-[#e3bdc3] bg-white p-4"><h4 class="font-extrabold">${item.name}</h4><p class="text-[#5a4044]">${item.document_date || item.status}</p></article>`).join('') : '<p class="text-[#5a4044]">No reports uploaded.</p>';
    } catch (error) {
      status.textContent = error.message;
      upcoming.innerHTML = '<h3 class="text-2xl font-extrabold">Database not connected</h3><p class="text-[#5a4044]">Start PostgreSQL and run npm run db:setup.</p>';
    }
  }
  load();
})();
