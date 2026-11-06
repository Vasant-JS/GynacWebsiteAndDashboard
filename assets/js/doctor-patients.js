(function () {
  const { $, $all, bindTabs, debounce, escapeHtml, loadingMarkup, setText } = window.Aura;
  const { appointmentPatientCard, searchPatientCard, api } = window.AuraDoctor;

  const status = $('#patient-registry-status');
  const input = $('#patient-search');
  const searchResults = $('#patient-results');
  const tabResults = $('#patient-tab-results');
  const tabButtons = $all('[data-patient-tab]');
  if (!input || !searchResults || !tabResults) return;

  const caseSheetView = new URLSearchParams(window.location.search).get('view') === 'case-sheets';
  if (caseSheetView) {
    setText($('#doctor-patients-title'), 'Clinical Case Sheets');
    setText($('#doctor-patients-description'), 'Choose a patient visit to open its clinical case sheet and consultation history.');
    document.title = 'Clinical Case Sheets | Sumohan Care';
  }

  let activeTab = 'current';
  let patientLists = { current: [], future: [], past: [] };
  const syncTabs = bindTabs(tabButtons, () => activeTab, (tab) => { activeTab = tab; }, renderTabs);

  function renderTabs() {
    syncTabs();
    const items = patientLists[activeTab] || [];
    const empty = activeTab === 'current'
      ? 'No current patients with appointments today.'
      : activeTab === 'past' ? 'No past consultations.' : 'No patients with future appointments.';
    tabResults.innerHTML = items.length
      ? items.map(appointmentPatientCard).join('')
      : `<p class="aura-card aura-card--padded text-[#5a4044]">${empty}</p>`;
  }

  async function loadLists() {
    tabResults.innerHTML = loadingMarkup('Loading patient registry...', 'aura-card aura-card--padded');
    try {
      const data = await api.patientLists();
      patientLists = { current: data.current || [], future: data.future || [], past: data.past || [] };
      setText(status, 'Connected to PostgreSQL');
      renderTabs();
    } catch (error) {
      setText(status, error.message);
      tabResults.innerHTML = `<p class="aura-card aura-card--padded text-[#ba1a1a]">${escapeHtml(error.message)}</p>`;
    }
  }

  async function searchPatients() {
    const q = input.value.trim();
    if (q.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    searchResults.innerHTML = loadingMarkup('Searching patients...', 'aura-card aura-card--padded');
    try {
      const data = await api.patientSearch(q);
      searchResults.innerHTML = (data.patients || []).map(searchPatientCard).join('') || '<p class="aura-card aura-card--padded text-[#5a4044]">No matching patients found.</p>';
    } catch (error) {
      searchResults.innerHTML = `<p class="aura-card aura-card--padded text-[#ba1a1a]">${escapeHtml(error.message)}</p>`;
    }
  }

  input.addEventListener('input', debounce(searchPatients, 250));
  loadLists();
})();
