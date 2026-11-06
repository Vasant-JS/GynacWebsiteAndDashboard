(async function () {
  const root = document.getElementById('doctor-account-settings');
  const esc = Aura.escapeHtml;
  try {
    const { doctors } = await Aura.fetchJson('/api/admin/doctors');
    root.innerHTML = `<h2 class="text-2xl font-bold">Doctor Accounts &amp; Profile Details</h2><p class="mt-3">Set a login email and password for each doctor. Only enter confirmed qualifications, experience and languages.</p><div class="grid gap-6 mt-6">${doctors.map(doctor => `<form data-doctor-account="${doctor.id}" class="rounded-xl border border-outline-variant bg-white p-6 grid gap-4"><h3 class="text-xl font-bold">${esc(doctor.display_name)}</h3><div class="grid gap-4 md:grid-cols-2"><label class="grid gap-2">Login email<input class="aura-field p-3" name="email" type="email" value="${esc(doctor.email || '')}" required></label><label class="grid gap-2">New password (12-72 characters)<input class="aura-field p-3" name="password" type="password" minlength="12" maxlength="72" autocomplete="new-password" placeholder="Leave blank to keep current password"></label><label class="grid gap-2">Qualifications<input class="aura-field p-3" name="qualifications" maxlength="500" value="${esc(doctor.profile?.qualifications || '')}"></label><label class="grid gap-2">Experience (years)<input class="aura-field p-3" name="experienceYears" type="number" min="0" max="80" step="any" value="${esc(doctor.profile?.experienceYears ?? '')}"></label><label class="grid gap-2">Consultation fee (INR)<input class="aura-field p-3" name="consultationFee" type="number" min="0.01" step="0.01" value="${esc(doctor.profile?.consultationFee ?? '')}"></label><label class="grid gap-2 md:col-span-2">Languages (comma separated)<input class="aura-field p-3" name="languages" value="${esc((doctor.profile?.languages || []).join(', '))}"></label></div><button class="aura-button justify-center" type="submit">Save Doctor Account</button><p data-account-message role="status"></p></form>`).join('')}</div>`;
  } catch (error) { root.textContent = error.message; }
  root.addEventListener('submit', async event => {
    const form = event.target.closest('[data-doctor-account]'); if (!form) return;
    event.preventDefault(); const message = form.querySelector('[data-account-message]'); const button = form.querySelector('button'); button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form)); data.languages = data.languages.split(',').map(value => value.trim()).filter(Boolean);
      const response = await Aura.fetchJson('/api/admin/doctors/' + form.dataset.doctorAccount + '/profile', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      message.textContent = response.message; form.elements.password.value = '';
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
})();
