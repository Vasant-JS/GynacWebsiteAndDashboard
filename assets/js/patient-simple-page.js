(function () {
  const target = document.getElementById('patient-page-content');
  const status = document.getElementById('patient-page-status');
  const mode = document.body.dataset.patientPage;
  const uploadForm = document.getElementById('document-upload-form');
  const uploadMessage = document.getElementById('document-upload-message');
  const tabButtons = Array.from(document.querySelectorAll('[data-document-tab]'));
  const appointmentTabs = Array.from(document.querySelectorAll('[data-appointment-tab]'));
  const actionModal = document.getElementById('appointment-action-modal');
  const modalTitle = document.getElementById('appointment-modal-title');
  const modalSubtitle = document.getElementById('appointment-modal-subtitle');
  const modalClose = document.getElementById('appointment-modal-close');
  const modalForm = document.getElementById('appointment-modal-form');
  const actionMessage = document.getElementById('appointment-action-message');
  let currentDocumentTab = 'reports';
  let currentAppointmentTab = 'upcoming';
  let lastData = null;
  let appointments = [];

  function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  async function load() {
    try {
      const endpoint = mode === 'appointments' ? '/api/patient/appointments' : mode === 'reports' ? '/api/patient/reports' : '/api/patient/profile';
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load data.');
      if (status) status.textContent = 'Connected to PostgreSQL';
      if (mode === 'appointments') {
        appointments = data.appointments || [];
        renderAppointments();
      }
      if (mode === 'reports') {
        lastData = data;
        renderDocumentTab();
      }
      if (mode === 'profile') {
        const patient = data.patient;
        target.innerHTML = `<section class="rounded-xl border border-[#e3bdc3] bg-white p-6"><h3 class="text-2xl font-extrabold">${patient.display_name}</h3><p class="mt-2 text-[#5a4044]">${patient.phone || ''} ${patient.email || ''}</p><pre class="mt-5 overflow-auto rounded-lg bg-[#f4f2ff] p-4 text-sm">${JSON.stringify(patient.profile || {}, null, 2)}</pre></section>`;
      }
    } catch (error) {
      if (status) status.textContent = error.message;
      target.innerHTML = '<p class="rounded-xl bg-white p-5 text-[#ba1a1a]">PostgreSQL is required to show exact data from DB.</p>';
    }
  }

  function isFutureAppointment(item) {
    const appointmentDate = new Date(item.appointment_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointmentDate.getTime() >= today.getTime() && item.status !== 'CANCELLED' && item.status !== 'COMPLETED';
  }

  function renderAppointments() {
    appointmentTabs.forEach((button) => {
      const active = button.dataset.appointmentTab === currentAppointmentTab;
      button.classList.toggle('border-b-2', active);
      button.classList.toggle('border-[#b0004a]', active);
      button.classList.toggle('text-[#b0004a]', active);
      button.classList.toggle('text-[#5a4044]', !active);
    });
    const visible = appointments.filter((item) => (currentAppointmentTab === 'upcoming' ? isFutureAppointment(item) : !isFutureAppointment(item)));
    target.innerHTML = visible.length ? visible.map(appointmentCard).join('') : `<p class="rounded-xl bg-white p-5 text-[#5a4044]">No ${currentAppointmentTab === 'upcoming' ? 'upcoming' : 'past'} appointments found.</p>`;
    wireAppointmentActions();
  }

  function appointmentCard(item) {
    const feedback = item.metadata?.feedback;
    const canChange = isFutureAppointment(item);
    const canComplete = item.status !== 'COMPLETED' && item.status !== 'CANCELLED';
    const hasPayment = Boolean(item.payment_id);
    const paymentLabel = hasPayment ? `${item.payment_currency || 'INR'} ${item.payment_amount || 0} - ${item.payment_status}` : 'Payment not started';
    return `
      <article class="rounded-xl border border-[#e3bdc3] bg-white p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm font-bold text-[#b0004a]">${formatDate(item.appointment_at)}</p>
            <h3 class="mt-1 text-xl font-extrabold">${item.service_type}</h3>
            <p class="text-[#5a4044]">${item.doctor_name || '-'} - ${item.location || '-'}</p>
            <p class="mt-3 inline-block rounded-full bg-[#edecff] px-3 py-1 text-sm font-bold">${item.status.replaceAll('_', ' ')}</p>
            <p class="mt-2 text-sm font-bold text-[#006a62]">${paymentLabel}</p>
            ${feedback ? `<p class="mt-3 text-sm text-[#5a4044]">Feedback: ${'★'.repeat(feedback.rating)} ${feedback.comment || ''}</p>` : ''}
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <button class="rounded-lg border border-[#ba1a1a] px-4 py-2 font-bold text-[#ba1a1a] disabled:opacity-40" data-appointment-cancel="${item.id}" ${canChange ? '' : 'disabled'} type="button">Cancel</button>
            <button class="rounded-lg border border-[#006a62] px-4 py-2 font-bold text-[#006a62] disabled:opacity-40" data-appointment-reschedule="${item.id}" ${canChange ? '' : 'disabled'} type="button">Reschedule</button>
            <button class="rounded-lg bg-[#006a62] px-4 py-2 font-bold text-white disabled:opacity-40" data-appointment-complete="${item.id}" ${canComplete ? '' : 'disabled'} type="button">Mark Completed</button>
            <button class="rounded-lg bg-[#b0004a] px-4 py-2 font-bold text-white" data-appointment-feedback="${item.id}" type="button">Feedback</button>
            ${item.payment_status === 'PAID' ? `<a class="rounded-lg border border-[#000767] px-4 py-2 font-bold text-[#000767]" href="/api/patient/payments/${item.payment_id}/receipt" target="_blank">Receipt</a>` : `<button class="rounded-lg bg-[#000767] px-4 py-2 font-bold text-white" data-appointment-pay="${item.id}" data-payment-id="${item.payment_id || ''}" type="button">${hasPayment ? 'Pay Now' : 'Create Payment'}</button>`}
          </div>
        </div>
      </article>
    `;
  }

  function appointmentById(id) {
    return appointments.find((item) => item.id === id);
  }

  function openModal(title, subtitle, content, onSubmit) {
    modalTitle.textContent = title;
    modalSubtitle.textContent = subtitle || '';
    actionMessage.textContent = '';
    modalForm.innerHTML = content;
    modalForm.onsubmit = onSubmit;
    actionModal.classList.remove('hidden');
    actionModal.classList.add('flex');
  }

  function closeModal() {
    actionModal?.classList.add('hidden');
    actionModal?.classList.remove('flex');
    if (modalForm) modalForm.onsubmit = null;
  }

  async function updateAppointmentStatus(id, statusValue) {
    const response = await fetch(`/api/patient/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusValue }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to update appointment.');
    await load();
  }

  function wireAppointmentActions() {
    target.querySelectorAll('[data-appointment-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancel this appointment?')) return;
      await updateAppointmentStatus(button.dataset.appointmentCancel, 'CANCELLED');
    }));
    target.querySelectorAll('[data-appointment-complete]').forEach((button) => button.addEventListener('click', async () => updateAppointmentStatus(button.dataset.appointmentComplete, 'COMPLETED')));
    target.querySelectorAll('[data-appointment-reschedule]').forEach((button) => {
      const item = appointmentById(button.dataset.appointmentReschedule);
      button.addEventListener('click', () => {
        const currentDate = new Date(item.appointment_at).toISOString().slice(0, 10);
        openModal('Reschedule Appointment', item.service_type, `<input class="rounded-lg border-[#e3bdc3]" name="date" type="date" value="${currentDate}" required><select class="rounded-lg border-[#e3bdc3]" name="time">${['09:00 AM','09:30 AM','10:30 AM','01:00 PM','02:30 PM','04:00 PM','06:30 PM','07:00 PM','07:30 PM'].map((s) => `<option>${s}</option>`).join('')}</select><button class="rounded-lg bg-[#b0004a] px-5 py-3 font-bold text-white" type="submit">Save Reschedule</button>`, async (event) => {
          event.preventDefault();
          const formData = new FormData(modalForm);
          try {
            const response = await fetch(`/api/patient/appointments/${item.id}/reschedule`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: formData.get('date'), time: formData.get('time') }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Could not reschedule.');
            closeModal();
            await load();
          } catch (error) {
            actionMessage.textContent = error.message;
          }
        });
      });
    });
    target.querySelectorAll('[data-appointment-feedback]').forEach((button) => {
      const item = appointmentById(button.dataset.appointmentFeedback);
      button.addEventListener('click', () => openModal('Feedback', item.service_type, `<label class="font-bold text-[#5a4044]">Stars</label><select class="rounded-lg border-[#e3bdc3]" name="rating"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Average</option><option value="2">★★ Needs improvement</option><option value="1">★ Poor</option></select><textarea class="rounded-lg border-[#e3bdc3]" name="comment" rows="5" placeholder="Write your comment"></textarea><button class="rounded-lg bg-[#b0004a] px-5 py-3 font-bold text-white" type="submit">Submit Feedback</button>`, async (event) => {
        event.preventDefault();
        const formData = new FormData(modalForm);
        try {
          const response = await fetch(`/api/patient/appointments/${item.id}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: Number(formData.get('rating')), comment: formData.get('comment') }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Could not save feedback.');
          closeModal();
          await load();
        } catch (error) {
          actionMessage.textContent = error.message;
        }
      }));
    });
    target.querySelectorAll('[data-appointment-pay]').forEach((button) => button.addEventListener('click', async () => {
      try {
        let paymentId = button.dataset.paymentId;
        if (!paymentId) {
          const createResponse = await fetch(`/api/patient/appointments/${button.dataset.appointmentPay}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 800 }) });
          const createData = await createResponse.json();
          if (!createResponse.ok) throw new Error(createData.message || 'Could not create payment.');
          paymentId = createData.payment.id;
        }
        const payResponse = await fetch(`/api/patient/payments/${paymentId}/pay`, { method: 'PATCH' });
        const payData = await payResponse.json();
        if (!payResponse.ok) throw new Error(payData.message || 'Could not complete payment.');
        await load();
      } catch (error) {
        alert(error.message);
      }
    }));
  }

  function renderDocumentTab() {
    if (!lastData) return;
    tabButtons.forEach((button) => {
      const active = button.dataset.documentTab === currentDocumentTab;
      button.classList.toggle('border-b-2', active);
      button.classList.toggle('border-[#b0004a]', active);
      button.classList.toggle('text-[#b0004a]', active);
      button.classList.toggle('text-[#5a4044]', !active);
    });
    if (currentDocumentTab === 'prescriptions') {
      target.innerHTML = lastData.prescriptions.length ? lastData.prescriptions.map((item) => {
        const medication = item.medications?.[0] || {};
        const advice = item.instructions?.advice || '';
        return `<article class="rounded-xl border border-[#e3bdc3] bg-white p-5"><p class="text-sm font-bold text-[#b0004a]">${formatDate(item.created_at)}</p><h3 class="text-xl font-extrabold">${medication.name || 'Prescription'}</h3><p class="text-[#5a4044]">${[medication.dosage, medication.frequency, medication.duration].filter(Boolean).join(' - ') || item.status}</p>${advice ? `<p class="mt-3 text-[#5a4044]">${advice}</p>` : ''}</article>`;
      }).join('') : '<p class="rounded-xl bg-white p-5 text-[#5a4044]">No doctor prescriptions found in DB.</p>';
      return;
    }
    const reports = lastData.reports || [];
    target.innerHTML = reports.length ? reports.map((report) => `<article class="rounded-xl border border-[#e3bdc3] bg-white p-5"><p class="text-sm font-bold text-[#b0004a]">${report.document_type === 'OLD_PRESCRIPTION' ? 'Old Prescription' : 'Uploaded Report'}</p><h3 class="text-xl font-extrabold">${report.name}</h3><p class="text-[#5a4044]">${report.document_date || report.status || 'Uploaded'}${report.file_name ? ` - ${report.file_name}` : ''}</p>${report.file_name ? `<a class="mt-3 inline-flex rounded-lg border border-[#b0004a] px-4 py-2 font-bold text-[#b0004a]" href="/api/patient/documents/${report.id}/download">Download</a>` : ''}</article>`).join('') : '<p class="rounded-xl bg-white p-5 text-[#5a4044]">No uploaded reports found in DB.</p>';
  }

  tabButtons.forEach((button) => button.addEventListener('click', () => { currentDocumentTab = button.dataset.documentTab; renderDocumentTab(); }));
  appointmentTabs.forEach((button) => button.addEventListener('click', () => { currentAppointmentTab = button.dataset.appointmentTab; renderAppointments(); }));
  modalClose?.addEventListener('click', closeModal);
  actionModal?.addEventListener('click', (event) => { if (event.target === actionModal) closeModal(); });
  uploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    uploadMessage.textContent = 'Uploading...';
    try {
      const response = await fetch('/api/patient/documents', { method: 'POST', body: new FormData(uploadForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Upload failed.');
      uploadMessage.textContent = 'Document uploaded.';
      uploadForm.reset();
      await load();
    } catch (error) {
      uploadMessage.textContent = error.message;
    }
  });

  load();
})();
