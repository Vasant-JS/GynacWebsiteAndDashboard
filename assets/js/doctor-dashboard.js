(function () {
  const { $, $all, bindTabs, escapeHtml, loadingMarkup, setText } = window.Aura;
  const { appointmentCard, emptyAppointmentsLabel, updateAppointmentStatus, api, searchPatientCard } = window.AuraDoctor;

  const status = $('#doctor-status');
  const schedule = $('#doctor-schedule-list');
  const updates = $('#doctor-updates-list');
  const search = $('#doctor-patient-search');
  const searchResults = $('#doctor-search-results');
  const tabButtons = $all('[data-dashboard-appointment-tab]');
  if (!status || !schedule || !updates) return;

  let activeTab = 'today';
  let rosterRequest = 0;
  const syncTabs = bindTabs(tabButtons, () => activeTab, (tab) => { activeTab = tab; }, loadRoster);

  async function loadRoster() {
    const request = ++rosterRequest;
    const period = activeTab;
    syncTabs();
    schedule.innerHTML = loadingMarkup('Loading appointments...');
    try {
      const data = await api.dashboardRoster(period);
      if (request !== rosterRequest) return;
      const items = data.appointments || [];
      schedule.innerHTML = items.length
        ? items.map(appointmentCard).join('')
        : `<p class="rounded-xl bg-white p-5 text-[#5a4044]">${emptyAppointmentsLabel(period)}</p>`;
    } catch (error) {
      if (request !== rosterRequest) return;
      schedule.innerHTML = `<p class="rounded-xl bg-white p-5 text-[#ba1a1a]">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderStats(data) {
    setText($('#today-appointments'), data.stats.todaysAppointments ?? 0);
    setText($('#pending-appointments'), data.stats.pendingAppointments ?? 0);
    setText($('#missed-appointments'), data.stats.missedAppointments ?? 0);
    setText($('#completed-appointments'), data.stats.completedAppointments ?? 0);
  }

  function renderUpdates(notifications) {
    updates.innerHTML = notifications.length
      ? notifications.map((item) => `<article class="border-b border-[#e3bdc3] py-4"><h4 class="font-extrabold">${escapeHtml(item.title)}</h4><p class="text-[#5a4044]">${escapeHtml(item.body)}</p></article>`).join('')
      : '<p class="text-[#5a4044]">No updates.</p>';
  }

  async function load() {
    updates.innerHTML = loadingMarkup('Loading updates...');
    try {
      const dashboard = await api.dashboard();
      const doctorName = dashboard.doctor.displayName || 'Doctor';
      setText($('#doctor-greeting'), `Good ${new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()) < 12 ? 'morning' : 'afternoon'}, ${doctorName}`);
      setText($('#dashboard-date'), new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date()));
      setText(status, 'Today’s clinic activity is up to date.');
      renderStats(dashboard);
      await loadRoster();
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
    try { await updateAppointmentStatus(cancelButton.dataset.cancel, 'CANCELLED'); await load(); }
    catch (error) { await load(); schedule.insertAdjacentHTML('afterbegin', `<p role="alert">${escapeHtml(error.message)}</p>`); }
  });
  search?.addEventListener('input', window.Aura.debounce(searchPatients, 250));

  load();
})();
