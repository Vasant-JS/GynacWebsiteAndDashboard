(function () {
  const fields = {
    name: document.getElementById('patient-profile-name'),
    fullName: document.getElementById('profile-full-name'),
    memberSince: document.getElementById('patient-profile-member-since'),
    mobile: document.getElementById('profile-mobile'),
    email: document.getElementById('profile-email'),
    age: document.getElementById('profile-age'),
    gender: document.getElementById('profile-gender'),
    address: document.getElementById('profile-address'),
    bloodGroup: document.getElementById('profile-blood-group'),
    allergies: document.getElementById('profile-allergies'),
    history: document.getElementById('profile-history'),
    conditions: document.getElementById('profile-conditions'),
  };
  const editButton = document.getElementById('edit-profile-button');
  let currentPatient = null;

  function setText(node, value) {
    if (node) node.textContent = value || '-';
  }

  function profileOf(patient) {
    return patient?.profile || {};
  }

  function displayName(patient) {
    return patient?.display_name || patient?.displayName || patient?.name || 'Patient';
  }

  function formatPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return phone || '-';
  }

  function formatMemberSince(patient) {
    const raw = profileOf(patient).registeredAt || patient?.created_at;
    if (!raw) return 'Member profile';
    try {
      return `Member since ${new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(raw))}`;
    } catch (_error) {
      return 'Member profile';
    }
  }

  function conditionText(profile) {
    const conditions = profile.conditions || {};
    const items = [];
    if (conditions.diabetes) items.push('Diabetes');
    if (conditions.bloodPressure) items.push('BP');
    if (conditions.other) items.push(conditions.other);
    return items.join(', ') || 'No conditions recorded';
  }

  function render(patient) {
    currentPatient = patient;
    const profile = profileOf(patient);
    const name = displayName(patient);
    setText(fields.name, name);
    setText(fields.fullName, name);
    setText(fields.memberSince, formatMemberSince(patient));
    setText(fields.mobile, formatPhone(patient.phone));
    setText(fields.email, patient.email);
    setText(fields.age, profile.age);
    setText(fields.gender, profile.gender || profile.sex);
    setText(fields.address, profile.permanentAddress || profile.address);
    setText(fields.bloodGroup, profile.bloodGroup || profile.bloodType || profile.blood_type);
    setText(fields.allergies, profile.allergies || 'None Recorded');
    setText(fields.history, profile.medicalHistory || profile.history || 'No history recorded');
    setText(fields.conditions, conditionText(profile));

    const sessionUser = {
      id: patient.id,
      role: 'PATIENT',
      displayName: name,
      email: patient.email,
      phone: patient.phone,
      profile,
    };
    localStorage.setItem('auraSessionUser_PATIENT', JSON.stringify(sessionUser));
    document.querySelectorAll('[data-session-person-name]').forEach((node) => {
      node.textContent = name;
    });
  }

  function modalMarkup(patient) {
    const profile = profileOf(patient);
    const conditions = profile.conditions || {};
    const genderValue = String(profile.gender || profile.sex || '');
    const genderOptions = ['', 'Male', 'Female', 'Prefer not to say'];
    const genderSelectOptions = genderOptions.map((option) => {
      const label = option || 'Select gender';
      return `<option value="${escapeAttr(option)}" ${option === genderValue ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    return `
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-[#000767]/35 p-4" id="patient-profile-modal" role="dialog" aria-modal="true">
        <form class="aura-card w-full max-w-3xl max-h-[90vh] overflow-auto p-6" id="patient-profile-form">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="aura-eyebrow">Patient Profile</p>
              <h2 class="text-3xl font-extrabold text-[#000767]">Edit Profile</h2>
            </div>
            <button class="grid h-10 w-10 place-items-center rounded-full border border-[#e3bdc3] text-[#5a4044]" id="patient-profile-close" type="button" aria-label="Close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="grid gap-2 font-bold text-[#5a4044]">Full Name<input class="aura-field rounded-lg p-3" name="name" value="${escapeAttr(displayName(patient))}" required></label>
            <label class="grid gap-2 font-bold text-[#5a4044]">Mobile Number<input class="aura-field rounded-lg p-3 bg-[#f4f2ff]" value="${escapeAttr(formatPhone(patient.phone))}" readonly></label>
            <label class="grid gap-2 font-bold text-[#5a4044]">Email<input class="aura-field rounded-lg p-3" name="email" type="email" value="${escapeAttr(patient.email || '')}" required></label>
            <label class="grid gap-2 font-bold text-[#5a4044]">Age<input class="aura-field rounded-lg p-3" name="age" type="number" min="1" max="120" value="${escapeAttr(profile.age || '')}"></label>
            <label class="grid gap-2 font-bold text-[#5a4044]">Gender<select class="aura-field rounded-lg p-3" name="gender">${genderSelectOptions}</select></label>
            <label class="grid gap-2 font-bold text-[#5a4044]">Blood Group<input class="aura-field rounded-lg p-3" name="bloodGroup" value="${escapeAttr(profile.bloodGroup || profile.bloodType || '')}"></label>
            <label class="grid gap-2 font-bold text-[#5a4044] md:col-span-2">Permanent Address<input class="aura-field rounded-lg p-3" name="address" value="${escapeAttr(profile.permanentAddress || profile.address || '')}"></label>
            <label class="grid gap-2 font-bold text-[#5a4044] md:col-span-2">Medical History<textarea class="aura-field min-h-24 rounded-lg p-3" name="history">${escapeHtml(profile.medicalHistory || profile.history || '')}</textarea></label>
            <label class="grid gap-2 font-bold text-[#5a4044] md:col-span-2">Allergies<textarea class="aura-field min-h-20 rounded-lg p-3" name="allergies">${escapeHtml(profile.allergies || '')}</textarea></label>
            <label class="flex items-center gap-3 font-bold text-[#5a4044]"><input class="rounded border-[#e3bdc3] text-[#b0004a]" name="diabetes" type="checkbox" ${conditions.diabetes ? 'checked' : ''}> Diabetes</label>
            <label class="flex items-center gap-3 font-bold text-[#5a4044]"><input class="rounded border-[#e3bdc3] text-[#b0004a]" name="bloodPressure" type="checkbox" ${conditions.bloodPressure ? 'checked' : ''}> BP</label>
            <label class="grid gap-2 font-bold text-[#5a4044] md:col-span-2">Other Conditions<input class="aura-field rounded-lg p-3" name="otherConditions" value="${escapeAttr(conditions.other || '')}"></label>
          </div>
          <p class="mt-4 min-h-5 text-sm font-bold text-[#ba1a1a]" id="patient-profile-message"></p>
          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button class="rounded-lg border border-[#e3bdc3] px-5 py-3 font-bold text-[#5a4044]" id="patient-profile-cancel" type="button">Cancel</button>
            <button class="aura-button px-5 py-3" type="submit">Save Profile</button>
          </div>
        </form>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function closeModal() {
    document.getElementById('patient-profile-modal')?.remove();
  }

  function openEditor() {
    if (!currentPatient) return;
    document.body.insertAdjacentHTML('beforeend', modalMarkup(currentPatient));
    const modal = document.getElementById('patient-profile-modal');
    const form = document.getElementById('patient-profile-form');
    const message = document.getElementById('patient-profile-message');
    document.getElementById('patient-profile-close')?.addEventListener('click', closeModal);
    document.getElementById('patient-profile-cancel')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    form?.addEventListener('submit', saveProfile);

    async function saveProfile(event) {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      message.textContent = 'Saving profile...';
      try {
        const formData = new FormData(form);
        const response = await fetch('/api/patient/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.get('name'),
            email: formData.get('email'),
            age: formData.get('age'),
            gender: formData.get('gender'),
            address: formData.get('address'),
            bloodGroup: formData.get('bloodGroup'),
            history: formData.get('history'),
            allergies: formData.get('allergies'),
            diabetes: formData.has('diabetes'),
            bloodPressure: formData.has('bloodPressure'),
            otherConditions: formData.get('otherConditions'),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not save profile.');
        render(data.patient);
        closeModal();
      } catch (error) {
        message.textContent = error.message;
      } finally {
        submitButton.disabled = false;
      }
    }
  }

  async function loadProfile() {
    try {
      setText(fields.name, 'Loading...');
      const response = await fetch('/api/patient/profile', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load patient profile.');
      render(data.patient);
    } catch (error) {
      setText(fields.name, 'Patient Profile');
      setText(fields.fullName, error.message);
    }
  }

  editButton?.addEventListener('click', openEditor);
  loadProfile();
})();
