(function () {
  const page = document.body.dataset.adminPage;
  const main = document.querySelector('main');
  if (!page || !main) return;

  function money(value, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(value || 0));
  }

  function date(value) {
    return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-';
  }

  async function jsonFetch(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load admin data.');
    return data;
  }

  const navItems = [
    ['dashboard', 'Admin Overview', '/admin/dashboard.html', 'dashboard'],
    ['doctors', 'Doctors', '/admin/doctors.html', 'stethoscope'],
    ['patients', 'Patient Records', '/admin/patients.html', 'groups'],
    ['revenue', 'Revenue', '/admin/revenue.html', 'payments'],
    ['settings', 'Settings', '/admin/settings.html', 'settings'],
  ];

  function sidebar() {
    const links = navItems.map(([key, label, href, icon]) => `
      <a href="${href}" ${page === key ? 'aria-current="page"' : ''}>
        <span class="material-symbols-outlined">${icon}</span>
        <span>${label}</span>
      </a>
    `).join('');

    return `
      <aside class="aura-sidebar">
        <div class="aura-sidebar__brand">
          <h1>Sumohan Care</h1>
          <p>Admin Central</p>
        </div>
        <div class="aura-sidebar__person">
          <div class="aura-avatar">
            <span class="material-symbols-outlined grid h-full w-full place-items-center text-[#b0004a]">admin_panel_settings</span>
          </div>
          <div>
            <p class="aura-sidebar__name">Admin User</p>
            <p class="aura-sidebar__meta">Super Admin Access</p>
          </div>
        </div>
        <nav class="aura-nav">${links}</nav>
        <div class="aura-sidebar__action">
          <a href="/admin/doctors.html"><span class="material-symbols-outlined">add</span>Add Doctor</a>
        </div>
      </aside>
    `;
  }

  function mobileNav() {
    return `
      <nav class="aura-mobile-nav">
        <a href="/admin/dashboard.html" ${page === 'dashboard' ? 'aria-current="page"' : ''}><span class="material-symbols-outlined">dashboard</span><span>Home</span></a>
        <a href="/admin/doctors.html" ${page === 'doctors' ? 'aria-current="page"' : ''}><span class="material-symbols-outlined">stethoscope</span><span>Doctors</span></a>
        <a href="/admin/patients.html" ${page === 'patients' ? 'aria-current="page"' : ''}><span class="material-symbols-outlined">groups</span><span>Patients</span></a>
        <a href="/admin/revenue.html" ${page === 'revenue' ? 'aria-current="page"' : ''}><span class="material-symbols-outlined">payments</span><span>Revenue</span></a>
      </nav>
    `;
  }

  function shell(title, subtitle, content) {
    main.innerHTML = `
      <div class="aura-shell">
        ${sidebar()}
        <section class="aura-main">
          <div class="aura-page">
            <p class="aura-eyebrow">Admin Central</p>
            <h1 class="aura-title">${title}</h1>
            <p class="aura-subtitle">${subtitle}</p>
            ${content}
          </div>
        </section>
      </div>
      ${mobileNav()}
    `;
  }

  function loadingShell(label = 'Loading data...') {
    shell(
      'Loading',
      'Please wait while Sumohan Care connects to PostgreSQL.',
      `<section class="aura-card aura-card--padded mt-8"><div class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>${label}</span></div></section>`,
    );
  }

  function statCard(label, value) {
    return `<div class="aura-card aura-card--padded"><p class="font-bold text-[#5a4044]">${label}</p><p class="mt-2 text-4xl font-extrabold">${value}</p></div>`;
  }

  async function renderDashboard() {
    loadingShell('Loading dashboard...');
    const data = await jsonFetch('/api/admin/dashboard');
    shell(
      'Dashboard Overview',
      `Connected to PostgreSQL. Welcome back, ${data.admin.displayName}.`,
      `<section class="mt-8 grid gap-4 md:grid-cols-4">
        ${statCard('Active Doctors', data.stats.active_doctors || 0)}
        ${statCard('Today Revenue', money(data.stats.todayRevenue))}
        ${statCard('Patients', data.stats.total_patients || 0)}
        ${statCard('Appointments', data.stats.today_appointments || 0)}
      </section>
      <section class="aura-card aura-card--padded mt-8 overflow-x-auto">
        <h2 class="text-2xl font-extrabold">Recent Activity</h2>
        <table class="mt-4 w-full text-left">
          <tbody>${data.activity.map((item) => `<tr class="border-t border-[#e3bdc3]"><td class="py-4 font-bold">${item.action}</td><td>${item.entity || '-'}</td><td>${item.status || '-'}</td><td>${date(item.timestamp)}</td></tr>`).join('')}</tbody>
        </table>
      </section>`,
    );
  }

  async function renderDoctors() {
    loadingShell('Loading doctors...');
    const data = await jsonFetch('/api/admin/doctors');
    shell(
      'Manage Doctors',
      'Directory of medical practitioners sourced from PostgreSQL.',
      `<form class="aura-card aura-card--padded mt-8 grid gap-3 md:grid-cols-5" id="admin-doctor-form">
        <input class="aura-field rounded-lg p-3" name="displayName" placeholder="Doctor name" required>
        <input class="aura-field rounded-lg p-3" name="email" placeholder="Email" type="email" required>
        <input class="aura-field rounded-lg p-3" name="specialization" value="Gynecology">
        <input class="aura-field rounded-lg p-3" name="consultationFee" type="number" value="800">
        <button class="aura-button" type="submit">Add Doctor</button>
      </form>
      <p class="mt-3 font-bold text-[#006a62]" id="admin-doctor-message"></p>
      <section class="aura-card aura-card--padded mt-8 overflow-x-auto">
        <table class="w-full text-left">
          <tbody>${data.doctors.map((doctor) => `<tr class="border-t border-[#e3bdc3]"><td class="py-4 font-bold">${doctor.display_name}<br><span class="font-normal text-[#5a4044]">${doctor.email || ''}</span></td><td>${doctor.specialization}</td><td>${money(doctor.consultationFee)}</td><td>${doctor.status}</td><td>${doctor.todaySlots} today</td><td><button class="rounded-lg border border-[#b0004a] px-3 py-2 font-bold text-[#b0004a]" data-toggle-doctor="${doctor.id}" data-status="${doctor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}">${doctor.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</tbody>
        </table>
      </section>`,
    );
    wireDoctors();
  }

  function wireDoctors() {
    const form = document.getElementById('admin-doctor-form');
    const message = document.getElementById('admin-doctor-message');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = 'Saving doctor...';
      try {
        await jsonFetch('/api/admin/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
        });
        await renderDoctors();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    document.querySelectorAll('[data-toggle-doctor]').forEach((button) => button.addEventListener('click', async () => {
      await jsonFetch(`/api/admin/doctors/${button.dataset.toggleDoctor}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: button.dataset.status }),
      });
      await renderDoctors();
    }));
  }

  async function renderPatients() {
    loadingShell('Loading patients...');
    const data = await jsonFetch('/api/admin/patients');
    shell(
      'Patient Records',
      'Admin-wide patient registry with flexible JSONB profile fields.',
      `<section class="mt-8 grid gap-4 md:grid-cols-3">
        ${statCard('Total Patients', data.stats.total_patients || 0)}
        ${statCard('New This Week', data.stats.new_this_week || 0)}
        ${statCard('Flexible Profiles', 'JSONB')}
      </section>
      <section class="aura-card aura-card--padded mt-8 overflow-x-auto">
        <table class="w-full text-left">
          <tbody>${data.patients.map((patient) => `<tr class="border-t border-[#e3bdc3]"><td class="py-4 font-bold">${patient.display_name}</td><td>${patient.phone || '-'}</td><td>${patient.email || '-'}</td><td>${patient.profile?.currentConcern || '-'}</td><td>${date(patient.created_at)}</td></tr>`).join('')}</tbody>
        </table>
      </section>`,
    );
  }

  async function renderRevenue() {
    loadingShell('Loading revenue...');
    const data = await jsonFetch('/api/admin/payments');
    shell(
      'Revenue',
      'Payment summaries sourced from the payments table.',
      `<section class="mt-8 grid gap-4 md:grid-cols-3">
        ${statCard('Today', money(data.summary.today))}
        ${statCard('Pending', money(data.summary.pending))}
        ${statCard('Refunds', money(data.summary.refunded))}
      </section>
      <section class="aura-card aura-card--padded mt-8 overflow-x-auto">
        <table class="w-full text-left">
          <tbody>${data.payments.map((payment) => `<tr class="border-t border-[#e3bdc3]"><td class="py-4 font-bold">${payment.patient_name || '-'}</td><td>${payment.service_type || '-'}</td><td>${money(payment.amount, payment.currency)}</td><td>${payment.status}</td><td>${date(payment.created_at)}</td><td>${payment.status === 'PENDING' ? `<button class="rounded-lg bg-[#006a62] px-3 py-2 font-bold text-white" data-pay-admin="${payment.id}">Mark Paid</button>` : '-'}</td></tr>`).join('')}</tbody>
        </table>
      </section>`,
    );
    document.querySelectorAll('[data-pay-admin]').forEach((button) => button.addEventListener('click', async () => {
      await jsonFetch(`/api/admin/payments/${button.dataset.payAdmin}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      await renderRevenue();
    }));
  }

  async function renderSettings() {
    loadingShell('Loading settings...');
    const data = await jsonFetch('/api/admin/settings/attributes');
    shell(
      'System Settings',
      'Flexible fields from entity_attributes.',
      `<section class="aura-card aura-card--padded mt-8">
        ${data.attributes.map((item) => `<label class="mb-3 flex items-center justify-between rounded-lg bg-[#f4f2ff] p-4 font-bold">${item.entity_type} - ${item.label}<input ${item.is_active ? 'checked' : ''} type="checkbox"></label>`).join('')}
      </section>`,
    );
  }

  ({ dashboard: renderDashboard, doctors: renderDoctors, patients: renderPatients, revenue: renderRevenue, settings: renderSettings }[page])?.().catch((error) => {
    shell('Database not connected', error.message, '<p class="aura-card aura-card--padded mt-8 text-[#ba1a1a]">PostgreSQL is required to show exact admin data.</p>');
  });
})();
