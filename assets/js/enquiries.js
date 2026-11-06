(async function () {
  const message = document.getElementById('enquiries-message');
  const list = document.getElementById('enquiries-list');
  const refresh = document.getElementById('enquiries-refresh');
  async function load() {
    message.textContent = 'Loading enquiries…';
    if (refresh) refresh.disabled = true;
    try {
      const { enquiries } = await Aura.fetchJson('/api/public/enquiries');
      list.innerHTML = enquiries.map(item => `<article class="aura-card aura-card--padded"><h2 class="text-xl font-bold">${Aura.escapeHtml(item.subject)}</h2><p class="mt-3">${Aura.escapeHtml(item.name)} · ${Aura.escapeHtml(item.email)} · ${Aura.escapeHtml(new Date(item.created_at).toLocaleString('en-IN'))}</p><p class="whitespace-pre-wrap mt-4">${Aura.escapeHtml(item.message)}</p><label class="grid gap-2 mt-4 max-w-sm">Enquiry status<select data-enquiry="${item.id}" class="aura-field p-3">${['NEW','IN_PROGRESS','CLOSED'].map(status => `<option ${status === item.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label></article>`).join('') || '<p>No contact enquiries yet.</p>';
      message.textContent = `${enquiries.length} recent enquiries`;
    } catch (error) { message.textContent = error.message; }
    finally { if (refresh) refresh.disabled = false; }
  }
  list.addEventListener('change', async event => {
    const input = event.target.closest('[data-enquiry]'); if (!input) return;
    input.disabled = true;
    try { await Aura.fetchJson('/api/public/enquiries/' + input.dataset.enquiry, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:input.value})}); message.textContent = 'Enquiry status saved.'; }
    catch (error) { message.textContent = error.message; await load(); }
    finally { input.disabled = false; }
  });
  refresh?.addEventListener('click',load);
  await load();
})();
