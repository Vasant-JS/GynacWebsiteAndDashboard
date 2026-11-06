(function () {
  const form = document.getElementById('case-history-form');
  if (!form) return;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const message = document.getElementById('case-history-message');
  const toolbar = document.getElementById('case-history-save');
  let appointmentId = '', version = 0, dirty = false, state = null;
  function childRow(child = {}) {
    return `<div class="case-child-row"><label>Gender<select data-child="gender" class="aura-field p-2"><option value="">Not recorded</option>${['Male', 'Female', 'Other', 'Unknown'].map(value => `<option ${child.gender === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Age (years)<input data-child="age" class="aura-field p-2" type="number" min="0" max="120" step="0.1" value="${esc(child.age)}"></label><label>Notes<input data-child="notes" class="aura-field p-2" maxlength="1000" value="${esc(child.notes)}"></label><button type="button" data-remove-child aria-label="Remove child row" class="case-remove">Remove</button></div>`;
  }
  function fieldMarkup(field) {
    const attr = `id="clinical-${field.key}" name="${field.key}" class="aura-field p-3 font-normal"`;
    let input;
    if (field.type === 'children') input = '<div id="case-children"></div><button type="button" id="case-add-child" class="case-secondary">Add child</button>';
    else if (field.type === 'multi') input = `<div class="case-options">${field.options.map(value => `<label><input type="checkbox" name="${field.key}" value="${esc(value)}"> ${esc(value)}</label>`).join('')}</div>`;
    else if (field.type === 'textarea') input = `<textarea ${attr} rows="3" maxlength="10000"></textarea>`;
    else if (field.type === 'select') input = `<select ${attr}><option value="">Not recorded</option>${field.options.map(value => `<option>${esc(value)}</option>`).join('')}</select>`;
    else input = `<input ${attr} type="${field.type}" ${field.type === 'number' ? `min="${field.min}" max="${field.max}" step="any"` : ''} ${field.type === 'text' ? 'maxlength="10000"' : ''}>`;
    if (field.type === 'multi' || field.type === 'children') return `<fieldset class="case-field case-wide" data-clinical-field="${field.key}"><legend>${esc(field.label)}</legend>${input}</fieldset>`;
    return `<label class="case-field ${field.type === 'textarea' ? 'case-wide' : ''}" data-clinical-field="${field.key}"><span>${esc(field.label)}</span>${input}</label>`;
  }
  document.getElementById('case-fields').innerHTML = Clinical.sections.map((section, index) => `<details class="case-section" ${index < 2 ? 'open' : ''}><summary>${section.title}</summary><div class="case-grid">${section.fields.map(fieldMarkup).join('')}${section.title === 'Obstetric history' ? '<div class="case-calculations case-wide"><div>Estimated due date<strong id="case-edd">—</strong></div><div>Gestation at assessment<strong id="case-pog">—</strong></div><p>LMP estimate assumes a 28-day cycle unless adjusted. Confirm dating clinically.</p><a href="https://www.nhs.uk/pregnancy/finding-out/due-date-calculator/" target="_blank" rel="noopener noreferrer">About estimated due dates</a></div>' : ''}${section.title === 'Physical measurements' ? '<div class="case-calculations case-wide">BMI (kg/m²)<strong id="case-bmi">—</strong></div>' : ''}</div></details>`).join('');
  function collect() {
    const data = {};
    for (const field of Clinical.fields) {
      if (field.type === 'children') data.children = [...form.querySelectorAll('.case-child-row')].map(row => Object.fromEntries([...row.querySelectorAll('[data-child]')].map(input => [input.dataset.child, input.value])));
      else if (field.type === 'multi') data[field.key] = [...form.querySelectorAll(`input[name="${field.key}"]:checked`)].map(input => input.value);
      else data[field.key] = form.elements[field.key].value;
    }
    return data;
  }
  function updateCalculations() {
    const data = collect(), result = Clinical.calculations(data);
    document.getElementById('case-edd').textContent = result.dueDate || '—';
    document.getElementById('case-pog').textContent = result.gestationWeeks === null ? '—' : `${result.gestationWeeks} weeks ${result.gestationDays} days`;
    document.getElementById('case-bmi').textContent = result.bmi === null ? '—' : result.bmi.toFixed(1);
    Clinical.fields.filter(field => field.showWhen).forEach(field => {
      const [key, value] = field.showWhen;
      form.querySelector(`[data-clinical-field="${field.key}"]`).hidden = data[key] !== value || (field.key === 'ictResult' && data.rh !== 'Negative');
    });
  }
  function hydrate(data = {}) {
    form.reset();
    Clinical.fields.forEach(field => {
      if (field.type === 'children') document.getElementById('case-children').innerHTML = (data.children || []).map(childRow).join('');
      else if (field.type === 'multi') form.querySelectorAll(`input[name="${field.key}"]`).forEach(input => input.checked = (data[field.key] || []).includes(input.value));
      else form.elements[field.key].value = data[field.key] ?? '';
    });
    if (!form.elements.assessmentDate.value) form.elements.assessmentDate.value = Clinical.today();
    updateCalculations();
  }
  function snapshotMarkup(data, calculations) {
    return Clinical.sections.map(section => `<section><h4>${section.title}</h4><dl>${section.fields.map(field => {
      let value = data?.[field.key];
      if (field.type === 'children') value = (value || []).map(child => [child.gender, child.age == null ? '' : `${child.age} years`, child.notes].filter(Boolean).join(' / ')).join('\n');
      else if (Array.isArray(value)) value = value.join(', ');
      if (value == null || value === '') return '';
      return `<dt>${esc(field.label)}</dt><dd>${esc(value)}</dd>`;
    }).join('')}</dl></section>`).join('') + `<p>EDD: ${esc(calculations?.dueDate || '—')} · Gestation: ${calculations?.gestationWeeks == null ? '—' : `${calculations.gestationWeeks}w ${calculations.gestationDays}d`} · BMI: ${esc(calculations?.bmi ?? '—')}</p>`;
  }
  function renderHistory() {
    document.getElementById('case-timeline').innerHTML = state.history.map(visit => `<details class="case-history-entry"><summary>${esc(new Date(visit.appointment_at).toLocaleDateString('en-IN', {timeZone:'Asia/Kolkata'}))} · ${esc(visit.service_type)} · ${esc(visit.doctor_name)} ${visit.id === appointmentId ? '(current visit)' : ''}</summary><p>${esc(visit.status)}</p>${visit.data ? snapshotMarkup(visit.data, visit.calculations) : `<p>${esc(visit.notes?.observations || visit.notes?.reason || 'No structured case sheet recorded.')}</p>`}</details>`).join('') || '<p>No previous visits.</p>';
    document.getElementById('case-revisions').innerHTML = state.revisions.map(revision => `<details class="case-history-entry"><summary>Version ${revision.version} · ${esc(new Date(revision.created_at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}))} · ${esc(revision.doctor_name)}</summary>${snapshotMarkup(revision.data, revision.calculations)}</details>`).join('') || '<p>No saved revisions yet.</p>';
  }
  async function load() {
    toolbar.disabled = true;
    const response = await fetch(`/api/doctor/appointments/${appointmentId}/case-history`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load case history.');
    state = data; version = data.sheet?.version || 0;
    document.getElementById('case-patient-id').textContent = data.caseId;
    hydrate(data.sheet?.data || {}); renderHistory();
    const clinical = data.sheet?.data;
    if (clinical?.bloodGroup) {
      const bloodType = clinical.bloodGroup + (clinical.rh === 'Positive' ? '+' : clinical.rh === 'Negative' ? '−' : '');
      for (const id of ['appointment-blood-type', 'prescription-patient-blood']) {
        const node = document.getElementById(id); if (node) node.textContent = bloodType;
      }
    }
    dirty = false; toolbar.disabled = false;
    message.textContent = version ? `Saved version ${version}.` : 'No case sheet saved for this visit yet.';
  }
  window.addEventListener('appointment-context-ready', async (event) => {
    if (appointmentId === event.detail.appointment.id) return;
    appointmentId = event.detail.appointment.id;
    try { await load(); } catch (error) { message.textContent = error.message; }
  });
  form.addEventListener('input', () => { dirty = true; message.textContent = 'Unsaved changes'; updateCalculations(); });
  form.addEventListener('change', updateCalculations);
  form.addEventListener('click', event => {
    if (event.target.closest('#case-add-child')) {
      if (form.querySelectorAll('.case-child-row').length >= 30) return;
      document.getElementById('case-children').insertAdjacentHTML('beforeend', childRow()); dirty = true; message.textContent = 'Unsaved changes';
    }
    if (event.target.closest('[data-remove-child]')) { event.target.closest('.case-child-row').remove(); dirty = true; message.textContent = 'Unsaved changes'; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!appointmentId) return;
    toolbar.disabled = true;
    try {
      const data = Clinical.normalize(collect());
      message.textContent = 'Saving case sheet…';
      const response = await fetch(`/api/doctor/appointments/${appointmentId}/case-history`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, version }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save case sheet.');
      dirty = false; await load(); message.textContent = `Case sheet saved · Version ${version}`;
    } catch (error) { message.textContent = error.message; }
    finally { toolbar.disabled = false; }
  });
  document.getElementById('case-reload').addEventListener('click', async () => {
    if (dirty && !window.confirm('Discard unsaved changes and load the latest saved case sheet?')) return;
    try { await load(); } catch (error) { message.textContent = error.message; }
  });
  document.getElementById('case-print').addEventListener('click', () => {
    if (!state) return;
    const popup = window.open('', '_blank');
    if (!popup) { message.textContent = 'Allow the print window to open, then try again.'; return; }
    const data = collect();
    popup.document.write(`<!doctype html><html lang="en"><head><title>Clinical Case Sheet</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#182044;font-size:12px}h1{font-size:22px}h4{font-size:15px;margin:20px 0 10px}dl{display:grid;grid-template-columns:1fr 1.5fr;gap:8px}dt{font-weight:bold}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}section{break-inside:avoid}p{line-height:1.5}@page{margin:18mm}button{padding:8px 16px}@media print{button{display:none}body{margin:0}}</style></head><body><h1>Sumohan Care · Clinical Case Sheet</h1><p>${esc(state.appointment.patient_name)}<br>${esc(state.caseId)}<br>Consultation: ${esc(new Date(state.appointment.appointment_at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}))}<br>${dirty ? 'Current form contains unsaved changes' : 'Saved version ' + version}</p>${snapshotMarkup(data, Clinical.calculations(data))}<button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    popup.document.close();
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  hydrate();
})();
