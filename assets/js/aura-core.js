(function () {
  if (window.Aura) return;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function setText(node, value) {
    if (node) node.textContent = value || '-';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthKey(value) {
    return String(value || todayKey()).slice(0, 7);
  }

  function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', options).format(new Date(value));
  }

  function loadingMarkup(label, className = 'rounded-xl bg-white p-5') {
    return `<div class="aura-loading ${className}"><span class="aura-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div>`;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);
    return data;
  }

  function bindTabs(buttons, getActive, setActive, render) {
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setActive(button.dataset.appointmentTab || button.dataset.dashboardAppointmentTab || button.dataset.patientTab);
        render();
      });
    });
    return function syncTabs() {
      buttons.forEach((button) => {
        const key = button.dataset.appointmentTab || button.dataset.dashboardAppointmentTab || button.dataset.patientTab;
        button.setAttribute('aria-selected', String(key === getActive()));
      });
    };
  }

  function debounce(callback, delay = 250) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  window.Aura = {
    $,
    $all,
    setText,
    escapeHtml,
    todayKey,
    monthKey,
    formatDate,
    loadingMarkup,
    fetchJson,
    bindTabs,
    debounce,
  };
})();
