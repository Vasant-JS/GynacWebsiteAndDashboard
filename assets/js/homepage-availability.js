(function () {
  const input = document.getElementById('home-availability-date');
  const slots = document.getElementById('home-availability-slots');
  const message = document.getElementById('home-availability-status');
  const proceed = document.getElementById('modal-confirm-btn');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const key = name => String(name).replace(/^Dr\.?\s*/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  let doctor = null, request = 0;
  async function hydrateProfiles() {
    const cards = [...document.querySelectorAll('.doctor-card[data-name]')];
    for (const card of cards) {
      card.dataset.languages='';
      const label=[...card.querySelectorAll('span')].find(node=>node.textContent.trim()==='Languages');
      if(label?.nextElementSibling)label.nextElementSibling.textContent='Loading…';
    }
    try {
      const response=await fetch('/api/public/doctors',{cache:'no-store'});const data=await response.json();
      if(!response.ok)throw new Error('Unavailable');
      for(const card of cards){
        const item=data.doctors.find(entry=>key(entry.name)===key(card.dataset.name));
        const languages=Array.isArray(item?.languages)?item.languages:[];
        card.dataset.languages=languages.join(' ').toLowerCase();
        const label=[...card.querySelectorAll('span')].find(node=>node.textContent.trim()==='Languages');
        if(label?.nextElementSibling)label.nextElementSibling.textContent=languages.join(', ') || 'Not provided';
        const panel=label?.parentElement?.parentElement;
        if(panel){const row=document.createElement('div');row.className='flex items-center justify-between text-body-sm font-body-sm';const name=document.createElement('span'),value=document.createElement('span');name.textContent='Experience';value.textContent=item?.experienceYears!=null?`${item.experienceYears} years`:'Not provided';value.className='font-semibold';row.append(name,value);panel.appendChild(row);}
      }
      if(typeof window.filterDoctors==='function')window.filterDoctors();
    } catch(_) {
      for(const card of cards){const label=[...card.querySelectorAll('span')].find(node=>node.textContent.trim()==='Languages');if(label?.nextElementSibling)label.nextElementSibling.textContent='Temporarily unavailable';}
    }
  }
  hydrateProfiles();
  async function loadSlots() {
    const token = ++request;
    slots.replaceChildren();
    if (!doctor || !input.value || !input.validity.valid) { message.textContent = 'Choose today or a future date.'; return; }
    message.textContent = 'Loading live availability…';
    try {
      const response = await fetch(`/api/public/doctors/${encodeURIComponent(doctor.id)}/availability?date=${encodeURIComponent(input.value)}`, { cache: 'no-store' });
      const data = await response.json();
      if (token !== request) return;
      if (!response.ok) throw new Error(data.message || 'Unable to load availability.');
      for (const time of data.slots) {
        const item = document.createElement('span');
        item.className = 'rounded-lg border border-outline-variant p-3 text-center text-body-sm';
        item.textContent = time; slots.appendChild(item);
      }
      message.textContent = data.slots.length ? `${data.slots.length} available times. Availability is checked again when you book.` : 'No slots available on this date. Choose another date.';
    } catch (error) { if (token === request) message.textContent = error.message; }
  }
  input.addEventListener('change', loadSlots);
  window.HomeDoctorAvailability = {
    async open(name) {
      const token = ++request; doctor = null; slots.replaceChildren(); proceed.disabled = true; input.disabled = true;
      input.min = input.value = today(); message.textContent = 'Loading doctor availability…';
      try {
        const response = await fetch('/api/public/doctors', { cache: 'no-store' });
        const data = await response.json();
        if (token !== request) return;
        if (!response.ok) throw new Error(data.message || 'Unable to load doctors.');
        doctor = data.doctors.find(item => key(item.name) === key(name));
        if (!doctor) throw new Error('This doctor is currently unavailable. Contact the hospital for assistance.');
        document.getElementById('modal-doctor-name').textContent = doctor.name;
        document.getElementById('modal-doctor-qual').textContent = [doctor.qualifications, doctor.specialization].filter(Boolean).join(' · ');
        proceed.disabled = false; input.disabled = false;
        await loadSlots();
      } catch (error) { if (token === request) message.textContent = error.message; }
    },
    close() { request++; },
  };
})();
