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
  let hasLoaded = false, page = 1, requestId = 0, filters = new URLSearchParams(), sort = 'transaction', direction = 'desc';
  const money = (amount, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(Number(amount || 0));
  const date = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '—';
  async function load({tableOnly=false}={}) {
    const id = ++requestId;
    previous.disabled = next.disabled = true;
    list.setAttribute('aria-busy','true');
    if(!hasLoaded){status.textContent = 'Loading payments…';list.innerHTML = '<tr><td colspan="9">Loading transaction history…</td></tr>';}
    try {
      const params = new URLSearchParams(filters); params.set('page', page);params.set('sort',sort);params.set('direction',direction);
      const data = await fetchJson('/api/doctor/payments?' + params);
      if (id !== requestId || !form.isConnected) return;
      status.textContent = 'Hospital consultation payments';
      if(!tableOnly || !hasLoaded) summary.innerHTML = data.summary.map(item => `<section class="aura-card aura-card--padded"><h2 class="font-extrabold">${esc(item.currency)} · Current filters</h2><div class="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">${[['Net paid',money(item.paid,item.currency),'payments'],['Pending',money(item.pending,item.currency),'schedule'],['Refunded',money(item.refunded,item.currency),'assignment_return'],['Failed transactions',String(item.failed_count),'error_outline']].map(([label,value,icon]) => `<div class="dp-summary-metric"><div><p class="text-sm text-[#5a4044]">${label}</p><p class="mt-1 text-xl font-extrabold">${esc(value)}</p></div><span class="dr-metric-icon material-symbols-outlined" aria-hidden="true">${icon}</span></div>`).join('')}</div></section>`).join('') + `<p class="text-sm text-[#5a4044]">${data.uncollected} matching bookings have no payment record. Totals include labelled demo entries.</p>`;
      const label=value=>esc((value || '—').replaceAll('_',' '));
      list.innerHTML = data.records.length ? data.records.map(item => `<tr><td class="dp-date">${esc(date(item.payment_created_at))}${item.payment_created_at?' IST':''}</td><td><strong>${esc(item.patient_name || 'Patient')}</strong><small>${esc(item.patient_phone || '')}</small><small class="dp-id">SC-${esc(item.patient_id || '')}</small></td><td class="dp-date">${esc(date(item.appointment_at))} IST<small>${esc(item.service_type)}</small></td><td>${esc(item.attended_by_name || 'Not yet attended')}</td><td class="dp-amount">${item.payment_id?esc(money(item.amount,item.currency)):'—'}${Number(item.refunded_amount)>0?`<small>Refunded: ${esc(money(item.refunded_amount,item.currency))}</small>`:''}</td><td><span class="dp-badge" data-status="${esc(item.payment_status)}">${label(item.payment_status)}</span>${item.is_demo?'<small>DEMO / TEST</small>':''}</td><td>${label(item.appointment_status)}</td><td class="dp-id">${esc(item.payment_id || 'No payment recorded')}<small>${esc(item.reference || '—')}</small></td><td class="dp-actions"><a class="dp-link" href="/doctor/appointment-details.html?appointmentId=${encodeURIComponent(item.appointment_id)}" title="View consultation">View</a>${item.payment_id?`<button type="button" class="dp-copy" data-copy="${esc(item.reference || item.payment_id)}" title="Copy payment reference">Copy ref</button>`:''}</td></tr>`).join('') : '<tr><td colspan="9" class="dp-empty">No payments or bookings match these filters.</td></tr>';
      hasLoaded = true;
      const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
      pageLabel.textContent = `${data.total} records · Page ${page} of ${pages}`;
      previous.disabled = page <= 1; next.disabled = page >= pages;
    } catch (error) {
      if (id !== requestId || !form.isConnected) return;
      status.textContent = 'Unable to load payments: '+error.message; if(!hasLoaded)list.innerHTML='<tr><td colspan="9">'+esc(error.message)+'</td></tr>';
    } finally {
      if(id===requestId)list.removeAttribute('aria-busy');
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); filters = new URLSearchParams(new FormData(form)); page = 1; load(); });
  form.addEventListener('reset', () => { filters = new URLSearchParams(); page = 1; load(); });
  document.querySelectorAll('[data-payment-sort]').forEach(button=>button.addEventListener('click',event=>{
    event.preventDefault();
    const key=button.dataset.paymentSort;direction=sort===key?(direction==='asc'?'desc':'asc'):(key==='patient'||key==='doctor'||key==='reference'?'asc':'desc');sort=key;page=1;
    document.querySelectorAll('[data-payment-sort]').forEach(item=>{const active=item===button;item.closest('th').setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');item.querySelector('span').textContent=active?(direction==='asc'?'↑':'↓'):'↕';});load({tableOnly:true});
  }));
  list.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='Copied';}catch{status.textContent='Could not copy. Select the reference in the table to copy it.';}});
  previous.addEventListener('click', () => { page--; load(); });
  next.addEventListener('click', () => { page++; load(); });
  load();
})();
