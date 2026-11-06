(function () {
  const form = document.getElementById('doctor-payments-filters');
  if (!form) return;
  const { escapeHtml: esc, fetchJson } = window.Aura;
  const list = document.getElementById('doctor-payments-list');
  const summary = document.getElementById('doctor-payments-summary');
  const status = document.getElementById('doctor-payments-status');
  const previous = document.getElementById('payments-prev');
  const next = document.getElementById('payments-next');
  const pageLabel = document.getElementById('doctor-payments-page');
  let page = 1, requestId = 0, filters = new URLSearchParams();
  const money = (amount, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(Number(amount || 0));
  const date = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '—';
  async function load() {
    const id = ++requestId;
    previous.disabled = next.disabled = true;
    status.textContent = 'Loading payments…';
    list.textContent = 'Loading transaction history…';
    summary.replaceChildren(); pageLabel.textContent = '';
    try {
      const params = new URLSearchParams(filters); params.set('page', page);
      const data = await fetchJson('/api/doctor/payments?' + params);
      if (id !== requestId || !form.isConnected) return;
      status.textContent = `${data.doctor.name} · Consultation payments`;
      summary.innerHTML = data.summary.map(item => `<section class="aura-card aura-card--padded"><h2 class="font-extrabold">${esc(item.currency)} · Current filters</h2><div class="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">${[['Net paid',money(item.paid,item.currency)],['Pending',money(item.pending,item.currency)],['Refunded',money(item.refunded,item.currency)],['Failed transactions',String(item.failed_count)]].map(([label,value]) => `<div><p class="text-sm text-[#5a4044]">${label}</p><p class="mt-1 text-xl font-extrabold">${esc(value)}</p></div>`).join('')}</div></section>`).join('') + `<p class="text-sm text-[#5a4044]">${data.uncollected} matching bookings have no payment record. Totals include labelled demo entries.</p>`;
      list.innerHTML = data.records.length ? data.records.map(item => `<article class="rounded-xl border border-[#e3bdc3] p-4" style="min-width:0;overflow-wrap:anywhere"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-sm font-bold text-[#006a62]">${esc(date(item.appointment_at))} IST</p><h3 class="mt-1 text-lg font-extrabold">${esc(item.patient_name || 'Patient')}</h3><p>${esc(item.service_type)}</p></div><div><p class="font-extrabold">${item.payment_id ? esc(money(item.amount,item.currency)) : '—'}</p><p class="text-sm font-bold">${esc(item.payment_status.replaceAll('_',' '))}${item.is_demo ? ' · DEMO' : ''}</p></div></div><dl class="mt-4 grid gap-3 text-sm md:grid-cols-2"><div><dt class="font-bold">Booking status</dt><dd>${esc(item.appointment_status.replaceAll('_',' '))}</dd></div><div><dt class="font-bold">Transaction date</dt><dd>${esc(date(item.payment_created_at))}${item.payment_created_at ? ' IST' : ''}</dd></div><div><dt class="font-bold">Transaction ID</dt><dd>${esc(item.payment_id || 'No payment recorded')}</dd></div><div><dt class="font-bold">Reference</dt><dd>${esc(item.reference || '—')}</dd></div></dl><a class="mt-4 inline-block font-bold text-[#b0004a]" href="/doctor/appointment-details.html?appointmentId=${encodeURIComponent(item.appointment_id)}">View consultation →</a></article>`).join('') : '<p>No payment records or bookings match these filters.</p>';
      const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
      pageLabel.textContent = `${data.total} records · Page ${page} of ${pages}`;
      previous.disabled = page <= 1; next.disabled = page >= pages;
    } catch (error) {
      if (id !== requestId || !form.isConnected) return;
      status.textContent = 'Unable to load payments'; list.textContent = error.message;
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); filters = new URLSearchParams(new FormData(form)); page = 1; load(); });
  form.addEventListener('reset', () => { filters = new URLSearchParams(); page = 1; load(); });
  previous.addEventListener('click', () => { page--; load(); });
  next.addEventListener('click', () => { page++; load(); });
  load();
})();
