(function () {
  const path = window.location.pathname;
  const portal = path.startsWith('/patient/')
    ? 'patient'
    : path.startsWith('/doctor/')
      ? 'doctor'
      : path.startsWith('/admin/')
        ? 'admin'
        : null;

  if (!portal || path.endsWith('/login.html')) return;

  const configs = {
    patient: {
      portalLabel: 'Patient Portal',
      person: 'Patient',
      meta: 'Welcome back',
      avatar: '<span class="material-symbols-outlined">person</span>',
      actionHref: '/patient/book-reason.html',
      actionIcon: 'add',
      actionLabel: 'Book New Consultation',
      nav: [
        ['Dashboard', '/patient/dashboard.html', 'dashboard'],
        ['Appointments', '/patient/appointments.html', 'calendar_today'],
        ['Medical Reports', '/patient/reports.html', 'description'],
      ],
      mobile: [
        ['Home', '/patient/dashboard.html', 'dashboard'],
        ['Visits', '/patient/appointments.html', 'calendar_today'],
        ['Reports', '/patient/reports.html', 'description'],
      ],
    },
    doctor: {
      portalLabel: 'Doctor Portal',
      person: 'Clinic Team',
      meta: 'Care dashboard',
      avatar: '<span class="material-symbols-outlined">stethoscope</span>',
      actionType: 'logout',
      actionIcon: 'logout',
      actionLabel: 'Logout',
      nav: [
        ['Dashboard', '/doctor/dashboard.html', 'dashboard'],
        ['Appointments', '/doctor/schedule.html', 'calendar_today'],
        ['Patients', '/doctor/patients.html', 'groups'],
        ['Slot Management', '/doctor/slots.html', 'event_available'],
        ['Settings', '/doctor/profile.html', 'settings'],
      ],
      mobile: [
        ['Home', '/doctor/dashboard.html', 'dashboard'],
        ['Schedule', '/doctor/schedule.html', 'calendar_today'],
        ['Patients', '/doctor/patients.html', 'groups'],
        ['Slots', '/doctor/slots.html', 'event_available'],
      ],
    },
    admin: {
      portalLabel: 'Admin Central',
      person: 'Admin User',
      meta: 'Super Admin Access',
      avatar: '<span class="material-symbols-outlined">admin_panel_settings</span>',
      actionHref: '/admin/doctors.html',
      actionIcon: 'add',
      actionLabel: 'Add Doctor',
      nav: [
        ['Admin Overview', '/admin/dashboard.html', 'dashboard'],
        ['Doctors', '/admin/doctors.html', 'stethoscope'],
        ['Patient Records', '/admin/patients.html', 'groups'],
        ['Revenue', '/admin/revenue.html', 'payments'],
        ['WhatsApp', '/admin/whatsapp.html', 'chat'],
        ['Settings', '/admin/settings.html', 'settings'],
      ],
      mobile: [
        ['Home', '/admin/dashboard.html', 'dashboard'],
        ['Doctors', '/admin/doctors.html', 'stethoscope'],
        ['Patients', '/admin/patients.html', 'groups'],
        ['Revenue', '/admin/revenue.html', 'payments'],
      ],
    },
  };

  const config = configs[portal];
  const sessionKey = `auraSessionUser_${portal.toUpperCase()}`;
  const routeSets = {
    patient: new Set([
      '/patient/dashboard.html',
      '/patient/appointments.html',
      '/patient/reports.html',
      '/patient/profile.html',
      '/patient/book-reason.html',
      '/patient/book-slot.html',
    ]),
    doctor: new Set([
      '/doctor/dashboard.html',
      '/doctor/schedule.html',
      '/doctor/patients.html',
      '/doctor/profile.html',
      '/doctor/slots.html',
      '/doctor/prescription.html',
      '/doctor/appointment-details.html',
    ]),
  };

  const doctorListDependencies = ['/assets/js/aura-core.js', '/assets/js/doctor-portal.js'];
  const pageScripts = {
    '/patient/dashboard.html': ['/assets/js/patient-dashboard.js'],
    '/patient/appointments.html': ['/assets/js/patient-simple-page.js'],
    '/patient/reports.html': ['/assets/js/patient-simple-page.js'],
    '/patient/profile.html': ['/assets/js/patient-profile.js'],
    '/patient/book-reason.html': ['/assets/js/design-live.js'],
    '/patient/book-slot.html': ['/assets/js/book-slot.js'],
    '/doctor/dashboard.html': [...doctorListDependencies, '/assets/js/doctor-dashboard.js'],
    '/doctor/schedule.html': [...doctorListDependencies, '/assets/js/doctor-appointments.js'],
    '/doctor/patients.html': [...doctorListDependencies, '/assets/js/doctor-patients.js'],
    '/doctor/profile.html': ['/assets/js/doctor-profile.js'],
    '/doctor/slots.html': ['/assets/js/doctor-slots.js'],
    '/doctor/appointment-details.html': ['/assets/js/doctor-appointment-details.js'],
    '/doctor/prescription.html': ['/assets/js/design-live.js'],
  };

  function isActive(href, currentPath = window.location.pathname) {
    if (currentPath === '/doctor/appointment-details.html' && href === '/doctor/schedule.html') return true;
    return currentPath === href;
  }

  function navLinks(items) {
    return items.map((item) => {
      const [label, href, icon] = item;
      return `
      <a href="${href}" ${isActive(href) ? 'aria-current="page"' : ''}>
        <span class="material-symbols-outlined">${icon}</span>
        <span>${label}</span>
      </a>
    `;
    }).join('');
  }

  const sidebar = document.createElement('aside');
  sidebar.className = 'aura-sidebar';
  sidebar.innerHTML = `
    <div class="aura-sidebar__brand">
      <h1>Sumohan Care</h1>
      <p>${config.portalLabel}</p>
    </div>
    <div class="aura-sidebar__person">
      <div class="aura-avatar">${config.avatar}</div>
      <div>
        <p class="aura-sidebar__name">${config.person}</p>
        <p class="aura-sidebar__meta">${config.meta}</p>
      </div>
    </div>
    <nav class="aura-nav">${navLinks(config.nav)}</nav>
    <div class="aura-sidebar__action">
      ${config.actionType === 'logout' ? `
      <button type="button" data-aura-logout>
        <span class="material-symbols-outlined">${config.actionIcon}</span>
        ${config.actionLabel}
      </button>
      ` : `
      <a href="${config.actionHref}">
        <span class="material-symbols-outlined">${config.actionIcon}</span>
        ${config.actionLabel}
      </a>
      `}
    </div>
  `;

  document.querySelector('body > nav.fixed, body > header')?.remove();

  const existingAside = document.querySelector('body > aside, body > .aura-shell > aside, body > .flex > aside');
  if (existingAside) {
    existingAside.replaceWith(sidebar);
  } else {
    const directFlex = document.body.firstElementChild?.classList?.contains('flex') && document.body.firstElementChild.querySelector(':scope > aside')
      ? document.body.firstElementChild
      : null;
    const shell = document.querySelector('.aura-shell') || directFlex;
    if (shell) {
      shell.prepend(sidebar);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'aura-shell';
      const content = document.createElement('main');
      content.className = 'aura-main';

      Array.from(document.body.childNodes).forEach((node) => {
        if (node === document.currentScript || node.nodeName === 'SCRIPT') return;
        content.appendChild(node);
      });

      wrapper.appendChild(sidebar);
      wrapper.appendChild(content);
      document.body.prepend(wrapper);
    }
  }

  document.querySelectorAll('.aura-mobile-nav, nav[class*="bottom-0"][class*="fixed"]').forEach((node) => node.remove());
  const mobileNav = document.createElement('nav');
  mobileNav.className = 'aura-mobile-nav';
  mobileNav.innerHTML = navLinks(config.mobile);
  document.body.appendChild(mobileNav);

  let navigationToken = 0;

  function contentHost() {
    const existing = document.querySelector('.aura-shell > .aura-main');
    if (existing) return existing;
    const main = document.querySelector('main');
    if (main) {
      main.classList.add('aura-main');
      return main;
    }
    return null;
  }

  function setActiveLinks(currentPath = window.location.pathname) {
    document.querySelectorAll('.aura-nav a, .aura-mobile-nav a').forEach((link) => {
      const active = link.getAttribute('href') === currentPath;
      link.toggleAttribute('aria-current', active);
      if (active) link.setAttribute('aria-current', 'page');
    });
  }

  function developerCredit() {
    return `
      <p class="aura-developer-credit">
        Developed by
        <a href="http://ekathvainnovations.com/" target="_blank" rel="noopener">Ekathva Innvoations</a>
      </p>
    `;
  }

  function ensureDeveloperCredit() {
    const host = contentHost();
    if (!host || host.querySelector('.aura-developer-credit')) return;
    const footer = host.querySelector('footer');
    if (footer) {
      footer.insertAdjacentHTML('beforeend', developerCredit());
      return;
    }
    host.insertAdjacentHTML('beforeend', `
      <footer class="aura-generated-footer">
        ${developerCredit()}
      </footer>
    `);
  }

  function readStoredUser() {
    try {
      const user = JSON.parse(localStorage.getItem(sessionKey) || localStorage.getItem('auraSessionUser') || 'null');
      return user && typeof user === 'object' ? user : null;
    } catch (_error) {
      return null;
    }
  }

  function writeStoredUser(user) {
    if (!user) return;
    localStorage.setItem(sessionKey, JSON.stringify(user));
  }

  function clearStoredUser() {
    localStorage.removeItem(sessionKey);
    const legacyUser = readStoredUser();
    if (legacyUser?.role === portal.toUpperCase()) localStorage.removeItem('auraSessionUser');
  }

  function applySessionPerson(user) {
    if (!user || user.role !== portal.toUpperCase()) return;
    const name = user.displayName || user.display_name || (portal === 'doctor' ? 'Doctor' : 'Patient');
    const profile = user.profile || {};
    const firstName = name.split(/\s+/)[0] || name;
    document.querySelectorAll('.aura-sidebar__name').forEach((node) => { node.textContent = name; });
    document.querySelectorAll('.aura-sidebar__meta').forEach((node) => {
      node.textContent = portal === 'doctor' ? (profile.title || profile.specialization || profile.designation || 'Care dashboard') : 'Welcome back';
    });
    document.querySelectorAll('.aura-avatar').forEach((node) => {
      if (!node.querySelector('img')) return;
      node.querySelector('img').alt = `${name} profile portrait`;
    });
    document.querySelectorAll('body > .aura-shell aside p, body > .flex aside p').forEach((node) => {
      if (node.textContent.trim() === 'Patient') node.textContent = name;
      if (node.textContent.trim() === 'Welcome back, Sarah') node.textContent = `Welcome back, ${firstName}`;
    });
    if (portal === 'patient') installPatientAccountMenu(name);
  }

  async function syncSessionPerson() {
    if (!['patient', 'doctor'].includes(portal)) return;
    applySessionPerson(readStoredUser());
    try {
      const response = await fetch(`/api/auth/me?role=${portal.toUpperCase()}`);
      const data = await response.json();
      const user = data.user;
      if (!response.ok || !user || user.role !== portal.toUpperCase()) return;
      writeStoredUser(user);
      applySessionPerson(user);
    } catch (_error) {
      // Keep static sidebar labels if the session lookup is unavailable.
    }
  }

  function installPatientAccountMenu(name) {
    const existingMenu = document.querySelector('[data-patient-account-menu]');
    if (existingMenu) {
      existingMenu.querySelector('[data-patient-account-name]').textContent = name;
      return;
    }

    const slot = document.querySelector('[data-patient-account-slot]');
    const loginButton = Array.from(document.querySelectorAll('button, a')).find((node) => node.textContent.trim() === 'Patient Login');
    const target = slot || loginButton || document.querySelector('main header .flex.items-center, main header');
    if (!target) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    wrapper.dataset.patientAccountMenu = 'true';
    wrapper.innerHTML = `
      <button class="flex items-center gap-2 rounded-full px-3 py-2 text-primary font-label-md text-label-md hover:bg-surface-container-low transition-colors" type="button" aria-expanded="false" data-patient-account-toggle>
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-primary font-bold">${name.trim().charAt(0).toUpperCase()}</span>
        <span data-patient-account-name>${name}</span>
        <span class="material-symbols-outlined text-base">expand_more</span>
      </button>
      <div class="absolute right-0 top-full z-50 mt-2 hidden min-w-44 rounded-lg border border-outline-variant bg-white p-2 shadow-xl" data-patient-account-dropdown>
        <a class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low" href="/patient/profile.html">
          <span class="material-symbols-outlined text-base">person</span>
          Profile
        </a>
        <button class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-error hover:bg-error-container" type="button" data-patient-logout>
          <span class="material-symbols-outlined text-base">logout</span>
          Logout
        </button>
      </div>
    `;

    if (slot) {
      slot.replaceWith(wrapper);
    } else if (loginButton) {
      loginButton.replaceWith(wrapper);
    } else {
      target.appendChild(wrapper);
    }

    const toggle = wrapper.querySelector('[data-patient-account-toggle]');
    const dropdown = wrapper.querySelector('[data-patient-account-dropdown]');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', isOpen);
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });
    wrapper.querySelector('[data-patient-logout]').addEventListener('click', async () => {
      clearStoredUser();
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'PATIENT' }) }).catch(() => null);
      window.location.href = '/patient/login.html';
    });
    document.addEventListener('click', (event) => {
      if (!wrapper.contains(event.target)) {
        dropdown.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function pageMode(routePath) {
    if (routePath.endsWith('/appointments.html')) return 'appointments';
    if (routePath.endsWith('/reports.html')) return 'reports';
    if (routePath.endsWith('/profile.html')) return 'profile';
    return '';
  }

  function removeRouteOverlays() {
    document.querySelectorAll('[data-aura-route-overlay]').forEach((node) => node.remove());
  }

  function installRouteOverlays(doc) {
    removeRouteOverlays();
    doc.querySelectorAll('#appointment-action-modal, #details-modal, #slot-editor-modal').forEach((node) => {
      const clone = document.importNode(node, true);
      clone.dataset.auraRouteOverlay = 'true';
      document.body.appendChild(clone);
    });
  }

  function runInlineProfileScripts(routePath) {
    if (!routePath.endsWith('/profile.html')) return;
    document.querySelectorAll('label[data-active]').forEach((label) => {
      label.addEventListener('click', function () {
        const isActive = this.getAttribute('data-active') === 'true';
        this.setAttribute('data-active', String(!isActive));
        const dot = this.querySelector('.h-4.w-4');
        const bg = this.querySelector('.relative.inline-flex');

        if (!isActive) {
          dot?.classList.remove('translate-x-1');
          dot?.classList.add('translate-x-6');
          bg?.classList.remove('bg-surface-container-highest');
          bg?.classList.add('bg-primary');
        } else {
          dot?.classList.remove('translate-x-6');
          dot?.classList.add('translate-x-1');
          bg?.classList.remove('bg-primary');
          bg?.classList.add('bg-surface-container-highest');
        }
      });
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${src}?spa=${Date.now()}`;
      script.async = false;
      script.addEventListener('load', () => {
        script.remove();
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function runPageScripts(routePath) {
    runInlineProfileScripts(routePath);
    for (const src of pageScripts[routePath] || []) {
      await loadScript(src);
    }
  }

  async function loadPortalRoute(href, push = true) {
    const url = new URL(href, window.location.origin);
    const routes = routeSets[portal];
    if (!routes?.has(url.pathname)) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return true;

    const token = ++navigationToken;
    const host = contentHost();
    if (!host) return false;

    host.setAttribute('aria-busy', 'true');
    try {
      const separator = url.search ? '&' : '?';
      const response = await fetch(`${url.pathname}${url.search}${separator}spa=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'X-Requested-With': 'fetch' },
      });
      const html = await response.text();
      if (!response.ok) throw new Error(`Could not load ${url.pathname}`);
      if (token !== navigationToken) return true;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = doc.querySelector('main');
      if (!nextMain) throw new Error('Page body is missing.');

      host.className = 'aura-main';
      host.innerHTML = nextMain.innerHTML;
      if (portal === 'patient') document.body.dataset.patientPage = pageMode(url.pathname);
      document.title = doc.title || document.title;
      installRouteOverlays(doc);
      setActiveLinks(url.pathname);
      if (push) window.history.pushState({ auraRoute: url.pathname }, '', `${url.pathname}${url.search}`);
      window.scrollTo({ top: 0, behavior: 'instant' });
      await runPageScripts(url.pathname);
      syncSessionPerson();
      ensureDeveloperCredit();
      return true;
    } catch (error) {
      console.error(error);
      host.innerHTML = `<section class="aura-page"><p class="aura-card aura-card--padded text-[#ba1a1a]">${error.message}</p></section>`;
      return true;
    } finally {
      host.removeAttribute('aria-busy');
    }
  }

  function handleRouteClick(event) {
    const logout = event.target.closest('[data-aura-logout]');
    if (logout) {
      event.preventDefault();
      clearStoredUser();
      fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: portal.toUpperCase() }) }).finally(() => {
        window.location.href = portal === 'doctor' ? '/staff/login.html' : '/website/index.html';
      });
      return;
    }

    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download') || event.defaultPrevented) return;
    const url = new URL(link.href, window.location.origin);
    const routes = routeSets[portal];
    if (url.origin !== window.location.origin || !routes?.has(url.pathname)) return;
    event.preventDefault();
    loadPortalRoute(`${url.pathname}${url.search}`);
  }

  if (routeSets[portal]) {
    document.body.addEventListener('click', handleRouteClick);
    window.addEventListener('popstate', () => loadPortalRoute(`${window.location.pathname}${window.location.search}`, false));
    setActiveLinks();
  }

  syncSessionPerson();
  ensureDeveloperCredit();
})();
