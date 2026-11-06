(function () {
  let patient = null;
  let navigationId = 0;
  let activeRequest = null;
  let pageCleanup = null;
  let pendingScriptLoad = Promise.resolve();
  const patientPages = new Set([
    '/patient/dashboard.html',
    '/patient/appointments.html',
    '/patient/reports.html',
    '/patient/profile.html',
    '/patient/book-reason.html',
    '/patient/book-slot.html',
  ]);
  const pageScripts = {
    '/patient/dashboard.html': '/assets/js/patient-dashboard.js?v=20261106-calendar',
    '/patient/appointments.html': '/assets/js/patient-simple-page.js?v=20261106-calendar',
    '/patient/reports.html': '/assets/js/patient-simple-page.js?v=20261106-calendar',
    '/patient/profile.html': '/assets/js/patient-profile.js?v=20261105-portal',
    '/patient/book-reason.html': '/assets/js/consultation-reason.js?v=20261106-booking-handoff',
    '/patient/book-slot.html': '/assets/js/book-slot.js?v=20261106-razorpay',
  };

  function updatePatient() {
    if (!patient) return;
    document.querySelectorAll('[data-patient-name]').forEach((node) => { node.textContent = patient.name || patient.display_name || patient.displayName || 'Patient'; });
    document.querySelectorAll('[data-patient-id]').forEach((node) => { node.textContent = patient.id ? `Case ID: SC-${patient.id}` : 'Patient portal'; });
  }

  async function mount(selector, path) {
    const target = document.querySelector(selector);
    if (!target) return;
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    target.innerHTML = await response.text();
  }

  function syncNavigation() {
    const current = ['/patient/book-reason.html', '/patient/book-slot.html'].includes(window.location.pathname)
      ? '/patient/appointments.html' : window.location.pathname;
    document.querySelectorAll('.patient-side__links a, .patient-mobile-nav a').forEach((link) => {
      if (new URL(link.href).pathname === current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function loadPageScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = pageScripts[path];
      script.dataset.patientRouteScript = '';
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${path}`));
      document.body.appendChild(script);
    });
  }

  async function navigate(destination, { history = true } = {}) {
    const url = new URL(destination, window.location.href);
    if (url.origin !== window.location.origin || !patientPages.has(url.pathname)) {
      window.location.href = url.href;
      return;
    }
    if (url.href === window.location.href && history) return;
    const requestId = ++navigationId;
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;
    try {
      const response = await fetch(url.href, { signal: controller.signal });
      if (!response.ok) throw new Error('Unable to open patient page.');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextMain = page.querySelector('.patient-app__main > main');
      const currentMain = document.querySelector('.patient-app__main > main');
      if (!nextMain || !currentMain) throw new Error('Patient page content is unavailable.');
      await pendingScriptLoad.catch(() => null);
      if (requestId !== navigationId) return;
      pageCleanup?.();
      pageCleanup = null;
      document.querySelectorAll('script[data-patient-route-script]').forEach((script) => script.remove());
      document.getElementById('appointment-action-modal')?.remove();
      document.getElementById('patient-profile-modal')?.remove();
      currentMain.replaceWith(nextMain);
      const appointmentModal = page.getElementById('appointment-action-modal');
      if (appointmentModal) document.body.appendChild(appointmentModal);
      document.body.className = page.body.className;
      document.body.dataset.patientPage = page.body.dataset.patientPage || '';
      document.title = page.title;
      if (history) window.history.pushState({ patientPortal: true }, '', url.href);
      syncNavigation();
      document.querySelector('[data-patient-menu-toggle]')?.setAttribute('aria-expanded', 'false');
      const menu = document.getElementById('patient-account-menu');
      if (menu) menu.hidden = true;
      window.scrollTo(0, 0);
      pendingScriptLoad = loadPageScript(url.pathname);
      await pendingScriptLoad;
    } catch (error) {
      if (error.name === 'AbortError' || requestId !== navigationId) return;
      console.error(error);
      window.location.href = url.href;
    }
  }

  function initNavigation() {
    syncNavigation();
    const toggle = document.querySelector('[data-patient-menu-toggle]');
    const menu = document.getElementById('patient-account-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        toggle.setAttribute('aria-expanded', String(!menu.hidden));
      });
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.patient-account')) {
          menu.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          menu.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
    document.querySelector('[data-patient-logout]')?.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'PATIENT' }) }).catch(() => null);
      window.location.href = '/patient/login.html';
    });
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !patientPages.has(url.pathname)) return;
      event.preventDefault();
      navigate(url.href);
    });
    window.addEventListener('popstate', () => navigate(window.location.href, { history: false }));
    updatePatient();
  }

  window.PatientShell = {
    setPatient(value) {
      patient = value;
      updatePatient();
    },
    navigate,
    registerCleanup(callback) {
      pageCleanup = callback;
    },
  };

  Promise.all([
    mount('#patient-sidebar-slot', '/patient/sidebar.html'),
    mount('#patient-navbar-slot', '/patient/navbar.html'),
    mount('#patient-mobile-nav-slot', '/patient/mobile-nav.html'),
  ]).then(async () => {
    initNavigation();
    if (document.body.dataset.patientPage === 'dashboard') return;
    try {
      const response = await fetch('/api/patient/profile');
      if (response.ok) window.PatientShell.setPatient((await response.json()).patient);
    } catch (_error) {
      // Page-specific scripts handle unavailable patient data.
    }
  }).catch((error) => {
    console.error(error);
    const navigation = document.querySelector('#patient-mobile-nav-slot');
    if (navigation) navigation.innerHTML = '<nav class="patient-mobile-nav"><a href="/patient/dashboard.html">Home</a><a href="/patient/appointments.html">Visits</a><a href="/patient/reports.html">Reports</a><a href="/patient/profile.html">Profile</a></nav>';
  });
})();
