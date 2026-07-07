(function () {
  const path = window.location.pathname;

  function textIncludes(tag, text) {
    return Array.from(document.querySelectorAll(tag)).find((el) => el.textContent.trim().includes(text));
  }

  function setText(idOrEl, value) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el && value !== undefined && value !== null) el.textContent = value;
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function money(value, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(value || 0));
  }

  async function jsonFetch(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }

  function buttonByText(text) {
    return Array.from(document.querySelectorAll('button, a')).find((el) => el.textContent.trim().includes(text));
  }

  function linkNav() {
    const linkMap = {
      'Patient Login': '/patient/login.html',
      'Book Appointment': '/patient/login.html?next=/patient/book-reason.html',
      Services: '/website/index.html',
      'Our Doctors': '/website/doctors.html',
      Clinics: '/website/index.html',
      Dashboard: '/patient/dashboard.html',
      Appointments: '/patient/appointments.html',
      'Medical Reports': '/patient/reports.html',
      Profile: '/patient/profile.html',
      'Book New Visit': '/patient/book-reason.html',
      'Book New Consultation': '/patient/book-reason.html',
      'Daily Schedule': '/doctor/schedule.html',
      'Patient Registry': '/doctor/patients.html',
      'Slot Management': '/doctor/slots.html',
      'Global Analytics': '/admin/dashboard.html',
      'Doctor Management': '/admin/doctors.html',
      'Patient Records': '/admin/patients.html',
      Revenue: '/admin/revenue.html',
      WhatsApp: '/admin/whatsapp.html',
      'System Settings': '/admin/settings.html',
    };
    Array.from(document.querySelectorAll('a, button')).forEach((el) => {
      const href = el.getAttribute('href');
      if (href?.startsWith('#') || el.hasAttribute('onclick')) return;
      const label = el.textContent.trim().replace(/\s+/g, ' ');
      const key = Object.keys(linkMap).find((item) => label === item || label.includes(item));
      if (!key) return;
      if (el.tagName === 'A') el.href = linkMap[key];
      if (el.tagName === 'BUTTON' && !el.dataset.boundNav) {
        el.dataset.boundNav = 'true';
        el.addEventListener('click', () => {
          window.location.href = linkMap[key];
        });
      }
    });
  }

  function initPatientLogin() {
    const phoneInput = document.querySelector('input[type="tel"]');
    const otpInputs = Array.from(document.querySelectorAll('#otp-phase input'));
    const sendButton = buttonByText('Send OTP');
    const verifyButton = buttonByText('Verify');
    const loginPhase = document.getElementById('login-phase');
    const otpPhase = document.getElementById('otp-phase');
    const nextUrl = new URLSearchParams(window.location.search).get('next');
    const safeNextUrl = nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//') ? nextUrl : '';
    let currentPhone = '';
    let message = document.querySelector('[data-login-message]');
    if (!message) {
      message = document.createElement('p');
      message.className = 'mt-base font-bold text-secondary';
      loginPhase?.appendChild(message);
    }
    function show(text, error) {
      message.textContent = text;
      message.className = `mt-base font-bold ${error ? 'text-error' : 'text-secondary'}`;
    }
    sendButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      currentPhone = phoneInput?.value?.trim() || '8892498859';
      try {
        show('Generating OTP...');
        const data = await jsonFetch('/api/auth/patient/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: currentPhone, whatsappNumber: currentPhone }),
        });
        show(`Dev OTP: ${data.otp}`);
        loginPhase?.classList.add('hidden');
        otpPhase?.classList.remove('hidden');
        if (otpInputs.length) String(data.otp).split('').forEach((digit, i) => { if (otpInputs[i]) otpInputs[i].value = digit; });
      } catch (error) {
        show(error.message, true);
      }
    });
    verifyButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const otp = otpInputs.map((input) => input.value).join('');
        const data = await jsonFetch('/api/auth/patient/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: currentPhone || phoneInput?.value, otp }),
        });
        window.location.href = safeNextUrl || data.redirectTo;
      } catch (error) {
        show(error.message, true);
      }
    });
  }

  async function initPatientDashboard() {
    try {
      const data = await jsonFetch('/api/patient/dashboard');
      const h1 = textIncludes('h1,h2', 'Aura Health');
      if (h1) h1.textContent = 'Aura Health';
      const subtitle = Array.from(document.querySelectorAll('p')).find((p) => p.textContent.includes('busy health week'));
      if (subtitle) subtitle.textContent = `Welcome back, ${data.patient.name}. Connected to PostgreSQL.`;
      const upcomingTitle = textIncludes('h2,h3', 'PostgreSQL required') || textIncludes('h2,h3', 'Prenatal');
      if (upcomingTitle && data.upcoming) upcomingTitle.textContent = data.upcoming.service_type;
      const upcomingCard = upcomingTitle?.closest('div');
      if (upcomingCard && data.upcoming) {
        const ps = upcomingCard.querySelectorAll('p');
        if (ps[1]) ps[1].textContent = `${data.upcoming.doctor_name || 'Doctor'} • ${formatDate(data.upcoming.appointment_at)}`;
      }
    } catch (error) {
      const p = Array.from(document.querySelectorAll('p')).find((node) => node.textContent.includes('busy health week'));
      if (p) p.textContent = error.message;
    }
  }

  function initReason() {
    const cards = Array.from(document.querySelectorAll('.reason-card'));
    const next = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Next');
    let selected = '';
    let other = document.getElementById('other-reason-input');
    if (!other) {
      other = document.createElement('textarea');
      other.id = 'other-reason-input';
      other.placeholder = 'If needed, describe your concern';
      other.className = 'w-full max-w-[900px] mt-gutter min-h-24 rounded-lg border-outline-variant bg-surface-container-lowest px-4 py-3';
      document.querySelector('.max-w-\\[1400px\\]')?.appendChild(other);
    }
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        cards.forEach((item) => {
          item.classList.remove('border-primary', 'ring-2', 'ring-primary');
          item.style.borderColor = '';
          item.style.boxShadow = '';
        });
        card.classList.add('border-primary', 'ring-2', 'ring-primary');
        card.style.borderColor = '#b0004a';
        card.style.boxShadow = '0 0 0 2px #b0004a';
        selected = card.querySelector('h3')?.textContent.trim() || '';
        sessionStorage.setItem('bookingReason', selected);
        if (next) {
          next.disabled = false;
          next.removeAttribute('disabled');
          next.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-surface-container', 'text-on-surface-variant');
          next.classList.add('bg-primary', 'text-white');
          next.style.backgroundColor = '#b0004a';
          next.style.color = '#ffffff';
          next.style.opacity = '1';
          next.style.cursor = 'pointer';
        }
      });
    });
    next?.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!selected) return;
      const data = await jsonFetch('/api/patient/booking/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: selected, otherReason: other.value.trim() }),
      });
      window.location.href = data.redirectTo;
    });
  }

  function initSlot() {
    let selectedDate = '';
    let selectedSlot = '';
    const dateButtons = Array.from(document.querySelectorAll('button')).filter((button) => /^\d{1,2}$/.test(button.textContent.trim()));
    const slotButtons = Array.from(document.querySelectorAll('button')).filter((button) => /^\d{2}:\d{2} [AP]M$/.test(button.textContent.trim()));
    const confirm = buttonByText('Confirm Slot');
    const selectedTimeLabel = Array.from(document.querySelectorAll('p')).find((p) => p.textContent.includes('Friday') || p.textContent.includes('01:00 PM'));
    const doctorSelect = document.getElementById('doctor-select');
    const serviceSelect = document.getElementById('service-select');
    const doctorName = document.getElementById('summary-doctor-name');
    const doctorInfo = document.getElementById('summary-doctor-info');
    const serviceLabel = document.getElementById('summary-service-label');
    const reasonLabel = document.getElementById('summary-reason-label');
    const doctors = {
      'Dr. Elena Rossi': 'Senior Gynecologist',
      'Dr. Sarah Jenkins': 'Fertility Specialist',
      'Dr. Maya Patel': 'Adolescent Health',
      'Dr. Chloe Chen': 'Maternity Lead',
    };
    if (reasonLabel) reasonLabel.textContent = sessionStorage.getItem('bookingReason') || reasonLabel.textContent;
    doctorSelect?.addEventListener('change', () => {
      if (doctorName) doctorName.textContent = doctorSelect.value;
      if (doctorInfo) doctorInfo.textContent = doctors[doctorSelect.value] || 'Gynecology Specialist';
    });
    serviceSelect?.addEventListener('change', () => {
      if (serviceLabel) serviceLabel.textContent = serviceSelect.value;
    });
    dateButtons.forEach((button) => button.addEventListener('click', async () => {
      dateButtons.forEach((item) => item.classList.remove('bg-primary', 'text-white', 'border-2'));
      button.classList.add('bg-primary', 'text-white', 'border-2');
      const yearMonth = new Date();
      selectedDate = `${yearMonth.getFullYear()}-${String(yearMonth.getMonth() + 1).padStart(2, '0')}-${String(Number(button.textContent.trim())).padStart(2, '0')}`;
      if (selectedTimeLabel) selectedTimeLabel.textContent = selectedSlot ? `${selectedDate} • ${selectedSlot}` : selectedDate;
    }));
    slotButtons.forEach((button) => button.addEventListener('click', async () => {
      slotButtons.forEach((item) => item.classList.remove('border-primary', 'bg-secondary-container', 'text-on-secondary-container', 'border-2'));
      button.classList.add('border-primary', 'bg-secondary-container', 'text-on-secondary-container', 'border-2');
      selectedSlot = button.textContent.trim();
      if (selectedTimeLabel) selectedTimeLabel.textContent = selectedDate ? `${selectedDate} • ${selectedSlot}` : selectedSlot;
      if (selectedDate) await jsonFetch('/api/patient/booking/slot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, time: selectedSlot }) }).catch(() => null);
    }));
    confirm?.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const data = await jsonFetch('/api/patient/booking/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, time: selectedSlot }),
        });
        window.location.href = data.redirectTo;
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function initSlotV2() {
    let selectedDate = '';
    let selectedSlot = '';
    let selectedDoctorId = '';
    let availabilityState = null;
    const dateButtons = Array.from(document.querySelectorAll('button')).filter((button) => /^\d{1,2}$/.test(button.textContent.trim()));
    const slotArea = textIncludes('h3', 'Available Slots')?.parentElement;
    const confirm = buttonByText('Confirm Slot');
    const selectedTimeLabel = Array.from(document.querySelectorAll('p')).find((p) => p.textContent.includes('Friday') || p.textContent.includes('01:00 PM'));
    const doctorSelect = document.getElementById('doctor-select');
    const serviceSelect = document.getElementById('service-select');
    const doctorName = document.getElementById('summary-doctor-name');
    const doctorInfo = document.getElementById('summary-doctor-info');
    const serviceLabel = document.getElementById('summary-service-label');
    const reasonLabel = document.getElementById('summary-reason-label');
    const fallbackDoctors = [
      { id: 'demo-elena', name: 'Dr. Elena Rossi', title: 'Senior Gynecologist', slots: generateSlots([['09:00', '12:00'], ['13:00', '16:00'], ['18:00', '19:30']]) },
      { id: 'demo-sarah', name: 'Dr. Sarah Jenkins', title: 'Fertility Specialist', slots: generateSlots([['10:00', '13:00'], ['15:00', '18:00']]) },
      { id: 'demo-maya', name: 'Dr. Maya Patel', title: 'Adolescent Health Specialist', slots: generateSlots([['09:30', '11:30'], ['14:00', '17:00']]) },
      { id: 'demo-chloe', name: 'Dr. Chloe Chen', title: 'Maternity Lead', slots: generateSlots([['08:30', '11:30'], ['13:30', '15:30'], ['18:00', '20:00']]) },
    ];

    function generateSlots(ranges) {
      return ranges.flatMap(([start, end]) => {
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        const slots = [];
        let cursor = startHour * 60 + startMinute;
        const endAt = endHour * 60 + endMinute;
        while (cursor <= endAt) {
          const hour24 = Math.floor(cursor / 60);
          const minute = cursor % 60;
          const period = hour24 >= 12 ? 'PM' : 'AM';
          const hour12 = hour24 % 12 || 12;
          slots.push(`${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`);
          cursor += 15;
        }
        return slots;
      });
    }

    function slotGroup(slot) {
      const match = slot.match(/^(\d{2}):(\d{2}) (AM|PM)$/);
      if (!match) return 'Other';
      const hour12 = Number(match[1]);
      const hour24 = match[3] === 'PM' && hour12 !== 12 ? hour12 + 12 : match[3] === 'AM' && hour12 === 12 ? 0 : hour12;
      if (hour24 < 12) return 'Morning';
      if (hour24 < 17) return 'Afternoon';
      return 'Evening';
    }

    function monthForAvailability() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function updateSelectedTimeLabel() {
      if (!selectedTimeLabel) return;
      selectedTimeLabel.textContent = selectedDate && selectedSlot ? `${selectedDate} • ${selectedSlot}` : selectedDate || selectedSlot || 'Select a date and slot';
    }

    function availableSlotsForDate() {
      if (!availabilityState) return [];
      const selectedAvailability = availabilityState.availability?.find((item) => item.date === selectedDate);
      if (selectedAvailability && selectedAvailability.is_available === false) return [];
      const baseSlots = selectedAvailability?.slots?.length ? selectedAvailability.slots : availabilityState.defaultSlots || [];
      const booked = new Set((availabilityState.booked || []).filter((item) => item.date === selectedDate).map((item) => item.slot));
      return baseSlots.filter((slot) => !booked.has(slot));
    }

    function renderSlots() {
      if (!slotArea) return;
      slotArea.querySelectorAll('.space-y-4, [data-dynamic-slots]').forEach((node) => node.remove());
      const wrapper = document.createElement('div');
      wrapper.dataset.dynamicSlots = 'true';
      wrapper.className = 'space-y-4';
      const slots = selectedDate ? availableSlotsForDate() : availabilityState?.defaultSlots || [];
      if (!slots.length) {
        wrapper.innerHTML = '<p class="rounded-lg bg-surface-container-low p-4 text-on-surface-variant">No slots available for this doctor/date.</p>';
        slotArea.appendChild(wrapper);
        return;
      }
      ['Morning', 'Afternoon', 'Evening'].forEach((group) => {
        const grouped = slots.filter((slot) => slotGroup(slot) === group);
        if (!grouped.length) return;
        const block = document.createElement('div');
        block.className = 'space-y-2';
        block.innerHTML = `<div class="flex items-center gap-2 text-label-md text-on-surface-variant"><span class="material-symbols-outlined text-base">${group === 'Morning' ? 'light_mode' : group === 'Afternoon' ? 'sunny' : 'dark_mode'}</span>${group}</div>`;
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-4 gap-2';
        grouped.forEach((slot) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = slot;
          button.className = slot === selectedSlot
            ? 'py-2 border-2 border-primary bg-secondary-container text-on-secondary-container rounded-lg font-label-md'
            : 'py-2 border border-outline-variant rounded-lg font-label-md hover:bg-secondary-container hover:border-secondary transition-all';
          button.addEventListener('click', async () => {
            selectedSlot = slot;
            updateSelectedTimeLabel();
            renderSlots();
            if (selectedDate) {
              await jsonFetch('/api/patient/booking/slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate, time: selectedSlot }),
              }).catch(() => null);
            }
          });
          grid.appendChild(button);
        });
        block.appendChild(grid);
        wrapper.appendChild(block);
      });
      slotArea.appendChild(wrapper);
    }

    async function saveBookingDetails() {
      await jsonFetch('/api/patient/booking/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          service: serviceSelect?.value || '',
          reason: reasonLabel?.textContent?.trim() || '',
        }),
      }).catch(() => null);
    }

    async function loadAvailability() {
      const fallbackDoctor = fallbackDoctors.find((doctor) => doctor.id === selectedDoctorId) || fallbackDoctors[0];
      availabilityState = { doctorId: fallbackDoctor.id, defaultSlots: fallbackDoctor.slots, availability: [], booked: [] };
      try {
        availabilityState = await jsonFetch(`/api/patient/booking/availability?doctorId=${encodeURIComponent(selectedDoctorId)}&month=${monthForAvailability()}`);
      } catch (_error) {
        // Keep demo slots when PostgreSQL is not running.
      }
      if (selectedSlot && !availableSlotsForDate().includes(selectedSlot)) selectedSlot = '';
      updateSelectedTimeLabel();
      renderSlots();
    }

    async function loadDoctors() {
      let doctors = fallbackDoctors;
      try {
        const data = await jsonFetch('/api/patient/booking/doctors');
        if (data.doctors?.length) doctors = data.doctors;
      } catch (_error) {
        // Keep demo doctors when PostgreSQL is not running.
      }
      if (doctorSelect) {
        doctorSelect.innerHTML = '';
        doctors.forEach((doctor) => {
          const option = document.createElement('option');
          option.value = doctor.id;
          option.textContent = doctor.name;
          option.dataset.title = doctor.title || doctor.specialization || 'Gynecology Specialist';
          doctorSelect.appendChild(option);
        });
        selectedDoctorId = doctorSelect.value || doctors[0]?.id || '';
        const selectedOption = doctorSelect.selectedOptions[0];
        if (doctorName) doctorName.textContent = selectedOption?.textContent || '';
        if (doctorInfo) doctorInfo.textContent = selectedOption?.dataset.title || 'Gynecology Specialist';
      }
      await saveBookingDetails();
      await loadAvailability();
    }

    if (reasonLabel) reasonLabel.textContent = sessionStorage.getItem('bookingReason') || reasonLabel.textContent;
    doctorSelect?.addEventListener('change', async () => {
      selectedDoctorId = doctorSelect.value;
      selectedSlot = '';
      const selectedOption = doctorSelect.selectedOptions[0];
      if (doctorName) doctorName.textContent = selectedOption?.textContent || '';
      if (doctorInfo) doctorInfo.textContent = selectedOption?.dataset.title || 'Gynecology Specialist';
      await saveBookingDetails();
      await loadAvailability();
    });
    serviceSelect?.addEventListener('change', async () => {
      if (serviceLabel) serviceLabel.textContent = serviceSelect.value;
      await saveBookingDetails();
    });
    dateButtons.forEach((button) => button.addEventListener('click', () => {
      dateButtons.forEach((item) => item.classList.remove('bg-primary', 'text-white', 'border-2'));
      button.classList.add('bg-primary', 'text-white', 'border-2');
      const yearMonth = new Date();
      selectedDate = `${yearMonth.getFullYear()}-${String(yearMonth.getMonth() + 1).padStart(2, '0')}-${String(Number(button.textContent.trim())).padStart(2, '0')}`;
      if (selectedSlot && !availableSlotsForDate().includes(selectedSlot)) selectedSlot = '';
      updateSelectedTimeLabel();
      renderSlots();
    }));
    confirm?.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await saveBookingDetails();
        const data = await jsonFetch('/api/patient/booking/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, time: selectedSlot }),
        });
        window.location.href = data.redirectTo;
      } catch (error) {
        alert(error.message);
      }
    });
    loadDoctors();
  }

  async function initDoctorDashboard() {
    try {
      const data = await jsonFetch('/api/doctor/dashboard');
      const statNumbers = Array.from(document.querySelectorAll('p')).filter((p) => /^\d+$/.test(p.textContent.trim()));
      if (statNumbers[0]) statNumbers[0].textContent = data.stats.todaysAppointments;
      if (statNumbers[1]) statNumbers[1].textContent = data.stats.pendingPrescriptions;
      if (statNumbers[2]) statNumbers[2].textContent = data.stats.consultationsDone;
      const search = document.querySelector('input[placeholder*="patient search"]');
      if (search) {
        search.placeholder = 'Search patient name or mobile...';
        const resultBox = document.createElement('div');
        resultBox.className = 'absolute top-full mt-2 left-0 right-0 z-50 grid gap-2';
        search.parentElement.appendChild(resultBox);
        search.addEventListener('input', async () => {
          if (search.value.trim().length < 2) {
            resultBox.innerHTML = '';
            return;
          }
          const result = await jsonFetch(`/api/doctor/patients/search?q=${encodeURIComponent(search.value.trim())}`);
          resultBox.innerHTML = result.patients.map((patient) => `<article class="rounded-lg bg-white p-3 shadow"><strong>${patient.name}</strong><p>${patient.phone || ''} • ${patient.concern}</p></article>`).join('');
        });
      }
      const scheduleHeading = textIncludes('h3', "Today's Schedule");
      const scheduleContainer = scheduleHeading?.parentElement?.parentElement?.querySelector('.space-y-gutter');
      if (scheduleContainer) {
        scheduleContainer.innerHTML = data.schedule.map((item) => `<article class="rounded-lg border border-outline-variant p-base"><p class="font-bold text-primary">${item.time} ${item.meridiem} - ${item.status}</p><h4 class="text-headline-md font-bold">${item.patientName}</h4><p>${item.serviceType}</p><div class="mt-base flex gap-base"><a class="rounded-lg bg-secondary px-4 py-2 text-white font-bold" href="/doctor/appointment-details.html?appointmentId=${item.id}">Attend Patient</a><button class="rounded-lg border border-error px-4 py-2 text-error font-bold" data-cancel="${item.id}">Cancel</button></div></article>`).join('');
      }
    } catch (error) {
      console.warn(error);
    }
  }

  async function initAppointmentDetails() {
    try {
      const id = new URLSearchParams(location.search).get('appointmentId');
      const data = await jsonFetch(`/api/doctor/appointment-context${id ? `?appointmentId=${encodeURIComponent(id)}` : ''}`);
      const name = textIncludes('h1', 'Sarah') || document.querySelector('h1');
      if (name) name.textContent = data.patient.name;
      const contact = Array.from(document.querySelectorAll('p')).find((p) => p.textContent.includes('+1') || p.textContent.includes('555'));
      if (contact) contact.textContent = data.patient.phone || data.patient.email || '-';
      const textarea = document.querySelector('textarea');
      if (textarea) textarea.value = data.appointment.notes?.observations || '';
      const save = buttonByText('Save Notes');
      const done = buttonByText('Mark as Completed');
      async function saveNotes(status) {
        await jsonFetch(`/api/doctor/appointments/${data.appointment.id}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observations: textarea?.value || '', recommendedActions: [], status }),
        });
        alert(status === 'COMPLETED' ? 'Appointment completed.' : 'Notes saved.');
      }
      save?.addEventListener('click', (event) => { event.preventDefault(); saveNotes('IN_PROGRESS'); });
      done?.addEventListener('click', (event) => { event.preventDefault(); saveNotes('COMPLETED'); });
    } catch (error) {
      console.warn(error);
    }
  }

  async function initAdminDashboard() {
    try {
      const data = await jsonFetch('/api/admin/dashboard');
      const nums = Array.from(document.querySelectorAll('h3,p')).filter((el) => /^(48|\$12,450|24)$/.test(el.textContent.trim()));
      if (nums[0]) nums[0].textContent = data.stats.active_doctors;
      if (nums[1]) nums[1].textContent = money(data.stats.todayRevenue);
      if (nums[2]) nums[2].textContent = data.stats.total_patients;
    } catch (error) {
      console.warn(error);
    }
  }

  async function initAdminDoctors() {
    try {
      const data = await jsonFetch('/api/admin/doctors');
      const tbody = document.querySelector('tbody');
      if (!tbody) return;
      tbody.innerHTML = data.doctors.map((doctor) => `<tr class="hover:bg-surface-container transition-colors group"><td class="px-6 py-4"><div class="w-12 h-12 rounded-full overflow-hidden border-2 border-primary-fixed"><img class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80"></div></td><td class="px-6 py-4"><p class="text-body-md font-bold text-on-surface">${doctor.display_name}</p><p class="text-body-sm text-on-surface-variant">${doctor.email || ''}</p></td><td class="px-6 py-4">${doctor.specialization}</td><td class="px-6 py-4"><p class="font-bold">${money(doctor.consultationFee)}</p></td><td class="px-6 py-4"><span class="inline-flex items-center px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-label-sm">${doctor.status}</span></td><td class="px-6 py-4 text-right">${doctor.todaySlots} slots today</td></tr>`).join('');
    } catch (error) {
      console.warn(error);
    }
  }

  linkNav();
  if (path.endsWith('/patient/login.html')) initPatientLogin();
  if (path.endsWith('/patient/dashboard.html')) initPatientDashboard();
  if (path.endsWith('/patient/book-reason.html')) initReason();
  if (path.endsWith('/patient/book-slot.html')) initSlotV2();
  if (path.endsWith('/doctor/dashboard.html')) initDoctorDashboard();
  if (path.endsWith('/doctor/appointment-details.html')) initAppointmentDetails();
  if (path.endsWith('/admin/dashboard.html')) initAdminDashboard();
  if (path.endsWith('/admin/doctors.html')) initAdminDoctors();
})();
