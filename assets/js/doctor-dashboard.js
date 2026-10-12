(function () {
  const { $, $all, bindTabs, escapeHtml, loadingMarkup, setText, todayKey } = window.Aura;
  const { appointmentCard, emptyAppointmentsLabel, filterAppointments, updateAppointmentStatus, api, searchPatientCard } = window.AuraDoctor;

  const status = $('#doctor-status');
  const schedule = $('#doctor-schedule-list');
  const updates = $('#doctor-updates-list');
  const search = $('#doctor-patient-search');
  const searchResults = $('#doctor-search-results');
  const tabButtons = $all('[data-dashboard-appointment-tab]');
  if (!status || !schedule || !updates) return;

  let activeTab = 'today';
  let appointments = [];
  const syncTabs = bindTabs(tabButtons, () => activeTab, (tab) => { activeTab = tab; }, renderSchedule);

  function renderSchedule() {
    syncTabs();
    const items = filterAppointments(appointments, activeTab, todayKey());
    schedule.innerHTML = items.length
      ? items.map(appointmentCard).join('')
      : `<p class="rounded-xl bg-white p-5 text-[#5a4044]">${emptyAppointmentsLabel(activeTab)}</p>`;
  }

  function renderStats(data) {
    setText($('#total-appointments'), data.stats.totalAppointments ?? data.stats.todaysAppointments);
    setText($('#pending-appointments'), data.stats.pendingAppointments ?? 0);
    setText($('#missed-appointments'), data.stats.missedAppointments ?? 0);
  }

  function renderUpdates(notifications) {
    updates.innerHTML = notifications.length
      ? notifications.map((item) => `<article class="border-b border-[#e3bdc3] py-4"><h4 class="font-extrabold">${escapeHtml(item.title)}</h4><p class="text-[#5a4044]">${escapeHtml(item.body)}</p></article>`).join('')
      : '<p class="text-[#5a4044]">No updates.</p>';
  }

  async function load() {
    schedule.innerHTML = loadingMarkup('Loading appointments...');
    updates.innerHTML = loadingMarkup('Loading updates...');
    try {
      const date = todayKey();
      const [dashboard, scheduleData] = await Promise.all([api.dashboard(), api.schedule(date, date.slice(0, 7))]);
      setText(status, `Connected to PostgreSQL - ${dashboard.doctor.displayName}`);
      appointments = scheduleData.monthly || [];
      renderStats(dashboard);
      renderSchedule();
      renderUpdates(dashboard.notifications || []);
    } catch (error) {
      setText(status, error.message);
      schedule.innerHTML = `<p class="rounded-xl bg-white p-5 text-[#ba1a1a]">${escapeHtml(error.message)}</p>`;
      updates.innerHTML = '<p class="text-[#5a4044]">No updates loaded.</p>';
    }
  }

  async function searchPatients() {
    const q = search.value.trim();
    if (q.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    searchResults.innerHTML = loadingMarkup('Searching patients...');
    try {
      const data = await api.patientSearch(q);
      searchResults.innerHTML = (data.patients || []).map(searchPatientCard).join('');
    } catch (error) {
      searchResults.innerHTML = `<p class="aura-card aura-card--padded text-[#ba1a1a]">${escapeHtml(error.message)}</p>`;
    }
  }

  schedule.addEventListener('click', async (event) => {
    const cancelButton = event.target.closest('[data-cancel]');
    if (!cancelButton) return;
    schedule.innerHTML = loadingMarkup('Updating appointment...');
    await updateAppointmentStatus(cancelButton.dataset.cancel, 'CANCELLED');
    await load();
  });
  search?.addEventListener('input', window.Aura.debounce(searchPatients, 250));

  load();
})();
