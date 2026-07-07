(function () {
  const status = document.getElementById('doctor-status');
  const schedule = document.getElementById('doctor-schedule-list');
  const updates = document.getElementById('doctor-updates-list');
  const search = document.getElementById('doctor-patient-search');
  const searchResults = document.getElementById('doctor-search-results');

  async function updateAppointment(id, statusValue) {
    const response = await fetch(`/api/doctor/appointments/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: statusValue }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not update appointment.');
    await load();
  }

  function renderSchedule(items) {
    schedule.innerHTML = items.length ? items.map((item) => `
      <article class="rounded-xl border border-[#e3bdc3] bg-white p-5">
        <p class="font-extrabold text-[#b0004a]">${item.time} ${item.meridiem} - ${item.label}</p>
        <h3 class="mt-1 text-2xl font-extrabold">${item.patientName}</h3>
        <p class="text-[#5a4044]">${item.serviceType}</p>
        <div class="mt-4 flex flex-wrap gap-2"><a class="rounded-lg bg-[#006a62] px-4 py-2 font-bold text-white" href="/doctor/appointment-details.html?appointmentId=${item.id}">Attend Patient</a><button class="rounded-lg border border-[#ba1a1a] px-4 py-2 font-bold text-[#ba1a1a]" data-cancel="${item.id}" type="button">Cancel</button></div>
      </article>
    `).join('') : '<p class="rounded-xl bg-white p-5 text-[#5a4044]">No appointments today.</p>';
    schedule.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => updateAppointment(button.dataset.cancel, 'CANCELLED')));
  }

  async function load() {
    try {
      const response = await fetch('/api/doctor/dashboard');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load dashboard.');
      status.textContent = `Connected to PostgreSQL • ${data.doctor.displayName}`;
      document.getElementById('todays-appointments').textContent = data.stats.todaysAppointments;
      document.getElementById('pending-prescriptions').textContent = data.stats.pendingPrescriptions;
      document.getElementById('consultations-done').textContent = data.stats.consultationsDone;
      renderSchedule(data.schedule || []);
      updates.innerHTML = data.notifications.length ? data.notifications.map((item) => `<article class="border-b border-[#e3bdc3] py-4"><h4 class="font-extrabold">${item.title}</h4><p class="text-[#5a4044]">${item.body}</p></article>`).join('') : '<p class="text-[#5a4044]">No updates.</p>';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  search?.addEventListener('input', async () => {
    const q = search.value.trim();
    if (q.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    const response = await fetch(`/api/doctor/patients/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    searchResults.innerHTML = (data.patients || []).map((patient) => `<article class="rounded-lg bg-white p-3"><h4 class="font-bold">${patient.name}</h4><p class="text-[#5a4044]">${patient.phone || ''} • ${patient.concern}</p></article>`).join('');
  });

  load();
})();
