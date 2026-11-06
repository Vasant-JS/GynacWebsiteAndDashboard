(async function () {
  const home = document.getElementById('home-doctor-roster');
  if (!home) return;
  const profile = document.getElementById('doctor-profile');
  const picker = document.getElementById('inline-doctor-select');
  const modal = document.getElementById('doctor-details');
  let selectDoctor;
  let previousOverflow = '';
  function showModal(doctor) {
    if (!modal.open) { previousOverflow = document.body.style.overflow; modal.showModal(); document.body.style.overflow = 'hidden'; }
    selectDoctor(doctor);
  }
  document.getElementById('doctor-modal-close').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => { document.body.style.overflow = previousOverflow; });
  modal.addEventListener('click', event => {
    if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); }
    if (event.target.closest('[data-booking-doctor]')) modal.close();
  });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let requestNumber = 0;
  try {
    const response = await fetch('/api/public/doctors'); const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load doctors.');
    const doctors = data.doctors || [];
    if (!doctors.length) throw new Error('No doctors are currently available. Contact the hospital for assistance.');
    for (const doctor of doctors) {
      const option = document.createElement('option'); option.value = doctor.id; option.textContent = doctor.name; picker.appendChild(option);
      document.getElementById('public-booking-doctor').appendChild(option.cloneNode(true));
    }
    function renderCards() {
      const query = document.getElementById('doctor-search').value.trim().toLowerCase();
      const specialty = document.getElementById('doctor-specialty').value;
      const language = document.getElementById('doctor-language').value;
      const visible = doctors.filter(doctor => (doctor.name + ' ' + doctor.qualifications + ' ' + doctor.specialization).toLowerCase().includes(query) && (!specialty || (doctor.title + ' ' + doctor.specialization).includes(specialty)) && (!language || doctor.languages.includes(language)));
      home.innerHTML = visible.map(doctor => '<button type="button" aria-haspopup="dialog" aria-controls="doctor-details" aria-label="View details and availability for ' + esc(doctor.name) + '" data-doctor-key="' + esc(doctor.key) + '" class="doctor-card w-full text-left bg-white rounded-2xl overflow-hidden tonal-elevation group"><div class="h-80 overflow-hidden"><img class="w-full h-full object-cover object-top" src="' + esc(doctor.photoUrl) + '" alt="' + esc(doctor.name) + '" loading="lazy"></div><div class="p-8"><h3 class="font-bold text-on-surface text-body-lg">' + esc(doctor.name) + '</h3><p class="text-primary text-body-sm mt-2">' + esc(doctor.qualifications) + '</p><span class="inline-flex mt-6 text-primary font-bold">View Profile &amp; Availability</span></div></button>').join('');
      document.getElementById('doctor-count').textContent = 'Showing ' + visible.length + ' doctor' + (visible.length === 1 ? '' : 's');
      document.getElementById('doctor-empty').hidden = visible.length > 0;
    }
    for (const id of ['doctor-search','doctor-specialty','doctor-language']) document.getElementById(id).addEventListener(id === 'doctor-search' ? 'input' : 'change', renderCards);
    selectDoctor = async function (doctor) {
      const selection = ++requestNumber;
      picker.value = doctor.id;
      profile.innerHTML = '<div class="aura-card aura-card--padded grid gap-8 md:grid-cols-[240px_1fr]"><img class="w-full h-72 object-cover object-top rounded-xl" src="' + esc(doctor.photoUrl) + '" alt="' + esc(doctor.name) + '"><div><h3 class="text-headline-md font-bold">' + esc(doctor.name) + '</h3><p class="text-primary font-bold mt-3">' + esc(doctor.qualifications) + '</p><p class="mt-4">' + esc(doctor.specialization) + '</p>' + (doctor.experienceYears != null ? '<p class="mt-3">' + esc(doctor.experienceYears) + ' years of experience</p>' : '') + (doctor.languages.length ? '<p class="mt-3">Languages: ' + esc(doctor.languages.join(', ')) + '</p>' : '') + '<p class="mt-3">Consultation fee: ' + (doctor.consultationFee == null ? 'Contact the hospital for details' : '₹' + esc(doctor.consultationFee)) + '</p><a class="aura-button mt-6" href="#booking" data-booking-doctor="' + doctor.id + '">Plan a Consultation</a></div></div><div class="aura-card aura-card--padded mt-6"><h3 class="text-headline-md font-bold">Available Consultation Slots</h3><label class="grid gap-2 mt-4 max-w-sm">Date (India Standard Time)<input id="public-availability-date" class="aura-field" type="date" min="' + today + '" value="' + today + '" required></label><p id="public-availability-message" class="mt-4" role="status"></p><div id="public-availability-slots" class="flex flex-wrap gap-3 mt-4"></div></div>';
      const input = document.getElementById('public-availability-date');
      let dateRequest = 0;
      async function loadSlots() {
        const dateSelection = ++dateRequest;
        const message = document.getElementById('public-availability-message');
        const slots = document.getElementById('public-availability-slots');
        message.textContent = 'Loading availability…'; slots.replaceChildren();
        try {
          const response = await fetch('/api/public/doctors/' + doctor.id + '/availability?date=' + encodeURIComponent(input.value)); const data = await response.json();
          if (selection !== requestNumber || dateSelection !== dateRequest) return;
          if (!response.ok) throw new Error(data.message);
          message.textContent = data.slots.length ? data.slots.length + ' available slots. Final availability is checked when you book.' : 'No slots available on this date.';
          slots.innerHTML = data.slots.map(slot => '<span class="rounded-lg border border-outline-variant px-3 py-2">' + esc(slot) + '</span>').join('');
        } catch (error) { if (selection === requestNumber && dateSelection === dateRequest) message.textContent = error.message; }
      }
      input.addEventListener('change', loadSlots); await loadSlots();
    }
    picker.addEventListener('change', () => selectDoctor(doctors.find(doctor => doctor.id === picker.value)));
    home.addEventListener('click', event => {
      const link = event.target.closest('[data-doctor-key]'); if (!link) return;
      showModal(doctors.find(doctor => doctor.key === link.dataset.doctorKey));
    });
    renderCards();
    const key = new URLSearchParams(location.search).get('doctor');
    const linkedDoctor = doctors.find(doctor => doctor.key === key || doctor.id === key);
    if (linkedDoctor) showModal(linkedDoctor);
  } catch (error) { profile.textContent = error.message; document.getElementById('doctor-count').textContent = error.message; }
})();
