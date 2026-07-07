(function () {
  const status = document.getElementById('schedule-status');
  const daily = document.getElementById('daily-schedule');
  const monthly = document.getElementById('monthly-schedule');
  const availabilityForm = document.getElementById('availability-form');
  const slotCheckboxes = Array.from(document.querySelectorAll('[data-slot-option]'));
  const dateInput = document.getElementById('availability-date');
  const availableInput = document.getElementById('availability-available');
  const message = document.getElementById('availability-message');

  function row(item) {
    return `<article class="rounded-xl border border-[#e3bdc3] bg-white p-5"><p class="font-extrabold text-[#b0004a]">${item.time || item.date}</p><h3 class="text-2xl font-extrabold">${item.patientName}</h3><p class="text-[#5a4044]">${item.serviceType} • ${item.status}</p><div class="mt-4 flex gap-2"><a class="rounded-lg bg-[#006a62] px-4 py-2 font-bold text-white" href="/doctor/appointment-details.html?appointmentId=${item.id}">Attend Patient</a><button class="rounded-lg border border-[#ba1a1a] px-4 py-2 font-bold text-[#ba1a1a]" data-cancel="${item.id}">Cancel</button></div></article>`;
  }

  async function updateAppointment(id, statusValue) {
    await fetch(`/api/doctor/appointments/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: statusValue }) });
    await load();
  }

  async function load() {
    const date = dateInput.value || new Date().toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const response = await fetch(`/api/doctor/schedule?date=${date}&month=${month}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load schedule.');
    status.textContent = 'Connected to PostgreSQL';
    daily.innerHTML = data.daily.length ? data.daily.map(row).join('') : '<p class="rounded-xl bg-white p-5 text-[#5a4044]">No daily appointments.</p>';
    monthly.innerHTML = data.monthly.length ? data.monthly.map(row).join('') : '<p class="rounded-xl bg-white p-5 text-[#5a4044]">No monthly appointments.</p>';
    document.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => updateAppointment(button.dataset.cancel, 'CANCELLED')));
  }

  availabilityForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const slots = slotCheckboxes.filter((input) => input.checked).map((input) => input.value);
    const response = await fetch('/api/doctor/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateInput.value, isAvailable: availableInput.checked, slots }) });
    const data = await response.json();
    message.textContent = response.ok ? 'Availability saved.' : data.message || 'Could not save availability.';
    await load();
  });
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateInput.addEventListener('change', load);
  load().catch((error) => { status.textContent = error.message; });
})();
