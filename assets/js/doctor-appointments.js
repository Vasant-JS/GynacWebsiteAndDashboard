(function () {
  const { $, $all, bindTabs, escapeHtml, loadingMarkup, monthKey, setText, todayKey } = window.Aura;
  const { appointmentCard, emptyAppointmentsLabel, filterAppointments, updateAppointmentStatus, api } = window.AuraDoctor;

  const status = $('#appointments-status');
  const list = $('#appointments-list');
  const dateInput = $('#appointments-date');
  const tabButtons = $all('[data-appointment-tab]');
  if (!status || !list || !dateInput) return;

  let activeTab = 'today';
  let appointments = [];
  const syncTabs = bindTabs(tabButtons, () => activeTab, (tab) => { activeTab = tab; }, render);

  function render() {
    syncTabs();
    const items = filterAppointments(appointments, activeTab, todayKey());
    list.innerHTML = items.length
      ? items.map(appointmentCard).join('')
      : `<p class="rounded-xl bg-white p-5 text-[#5a4044]">${emptyAppointmentsLabel(activeTab)}</p>`;
  }

  async function updateAppointment(id, statusValue) {
    list.innerHTML = loadingMarkup('Updating appointment...');
    await updateAppointmentStatus(id, statusValue);
    await load();
  }

  async function load() {
    list.innerHTML = loadingMarkup('Loading appointments...');
    try {
      const date = dateInput.value || todayKey();
      const data = await api.schedule(date, monthKey(date));
      appointments = data.monthly || [];
      setText(status, 'Connected to PostgreSQL');
      render();
    } catch (error) {
      setText(status, error.message);
      list.innerHTML = `<p class="rounded-xl bg-white p-5 text-[#ba1a1a]">${escapeHtml(error.message)}</p>`;
    }
  }

  dateInput.value = todayKey();
  dateInput.addEventListener('change', load);
  list.addEventListener('click', (event) => {
    const cancelButton = event.target.closest('[data-cancel]');
    if (cancelButton) updateAppointment(cancelButton.dataset.cancel, 'CANCELLED');
  });

  load();
})();
