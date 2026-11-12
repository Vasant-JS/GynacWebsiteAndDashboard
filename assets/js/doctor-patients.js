(function(){
  const root=document.querySelector('.dr-registry');if(!root)return;
  const {escapeHtml:esc,fetchJson}=window.Aura,signal=window.DoctorPage.signal;
  const node=id=>root.querySelector('[id="'+id+'"]');
  const search=node('patient-search'),service=node('registry-service'),statusFilter=node('registry-status-filter'),rows=node('patient-tab-results');
  const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const today=day(new Date()),caseView=new URLSearchParams(location.search).get('view')==='case-sheets';
  let visits=[],activeTab='all',page=1,pageSize=10,ready=false;
  const statusLabel=value=>String(value || 'Not recorded').replaceAll('_',' ');
  const date=value=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  function renderRow(visit){
    const patient=visit.patient || {},profile=patient.profile || {},query='?appointmentId='+encodeURIComponent(visit.appointmentId);
    const initials=String(patient.name || 'Patient').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
    const demographics=[profile.age!=null && profile.age!==''?profile.age+' years':'',profile.gender,profile.city].filter(Boolean).join(' · ');
    return `<tr><td><a class="dr-case-id" href="/doctor/case-history.html${query}">SC-${esc(patient.id)}</a></td><td><div class="dr-person"><span class="dr-avatar" aria-hidden="true">${esc(initials)}</span><div><strong>${esc(patient.name || 'Patient')}</strong><p class="dr-muted">${esc(demographics || 'Demographics not recorded')}</p><p class="dr-contact">${esc(patient.phone || patient.email || 'Contact not recorded')}</p></div></div></td><td><span class="dr-service">${esc(visit.serviceType || 'Not recorded')}</span><p class="dr-muted">${visit.attendedName?'Attended by: '+esc(visit.attendedName):'Not yet attended'}</p></td><td><strong class="dr-date">${esc(date(visit.appointmentAt))}</strong><p class="dr-muted">India Standard Time</p></td><td><span class="dr-badge ${visit.status==='COMPLETED'?'dr-badge--complete':visit.status==='IN_PROGRESS'?'dr-badge--active':''}">${esc(statusLabel(visit.status))}</span></td><td><div class="dr-row-actions"><a class="dr-button dr-button--light" href="/doctor/case-history.html${query}"><span class="material-symbols-outlined" aria-hidden="true">clinical_notes</span>Case Sheet</a><a class="dr-icon-button" href="/doctor/prescription.html${query}" aria-label="Prescription for ${esc(patient.name)}" title="Prescription"><span class="material-symbols-outlined" aria-hidden="true">prescriptions</span></a><a class="dr-icon-button" href="/doctor/appointment-details.html${query}" aria-label="Consultation details for ${esc(patient.name)}" title="Consultation details"><span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></a></div></td></tr>`;
  }
  function matches(visit){const patient=visit.patient || {},key=day(visit.appointmentAt),q=search.value.trim().toLocaleLowerCase();
    return (activeTab==='all' || (activeTab==='current'?key===today:activeTab==='future'?key>today:key<today)) && (!service.value || visit.serviceType===service.value) && (!statusFilter.value || visit.status===statusFilter.value) && (!q || [patient.name,patient.phone,patient.email,'SC-'+patient.id].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));
  }
  function render(){
    if(!ready)return;
    root.querySelectorAll('[data-patient-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.patientTab===activeTab)));
    const selected=visits.filter(matches),pages=Math.max(1,Math.ceil(selected.length/pageSize));page=Math.min(page,pages);
    const start=(page-1)*pageSize,end=Math.min(start+pageSize,selected.length);
    rows.innerHTML=selected.slice(start,end).map(renderRow).join('') || '<tr><td colspan="6" class="dr-empty">No consultations match these filters.</td></tr>';
    node('registry-matches').textContent=selected.length+' matching '+(selected.length===1?'consultation':'consultations')+' of '+visits.length;
    node('registry-page-summary').textContent=selected.length?'Showing '+(start+1)+'–'+end+' of '+selected.length+' consultations':'No matching consultations';
    node('registry-page-number').textContent='Page '+page+' of '+pages;
    node('registry-prev').disabled=page===1;node('registry-next').disabled=page===pages;
  }
  function filter(){page=1;render();}
  search.addEventListener('input',filter);service.addEventListener('change',filter);statusFilter.addEventListener('change',filter);
  root.querySelectorAll('[data-patient-tab]').forEach(button=>button.onclick=()=>{activeTab=button.dataset.patientTab;filter();});
  node('registry-clear').onclick=()=>{search.value='';service.value='';statusFilter.value='';activeTab='all';filter();};
  node('registry-page-size').onchange=event=>{pageSize=Number(event.target.value);filter();};
  node('registry-prev').onclick=()=>{page--;render();};node('registry-next').onclick=()=>{page++;render();};
  if(caseView){node('doctor-patients-title').textContent='Clinical Case Sheets';node('doctor-patients-description').textContent='Choose an hospital consultation to review its saved case sheet and patient history.';node('registry-body-title').textContent='Clinical Case Sheets & Patient History';document.title='Clinical Case Sheets | Sumohan Care';}
  (async()=>{try{
    const lists=await fetchJson('/api/doctor/patients/lists');if(signal.aborted)return;
    visits=[...new Map([...(lists.current || []),...(lists.future || []),...(lists.past || [])].map(visit=>[visit.appointmentId,visit])).values()].sort((a,b)=>new Date(b.appointmentAt)-new Date(a.appointmentAt));
    node('registry-total').textContent=new Set(visits.map(visit=>visit.patient.id)).size;
    node('registry-today').textContent=visits.filter(visit=>day(visit.appointmentAt)===today).length;
    node('registry-upcoming').textContent=visits.filter(visit=>day(visit.appointmentAt)>today && !['COMPLETED','CANCELLED'].includes(visit.status)).length;
    node('registry-completed').textContent=visits.filter(visit=>visit.status==='COMPLETED').length;
    service.innerHTML='<option value="">All services</option>'+[...new Set(visits.map(visit=>visit.serviceType).filter(Boolean))].sort().map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
    statusFilter.innerHTML='<option value="">All statuses</option>'+[...new Set(visits.map(visit=>visit.status).filter(Boolean))].sort().map(value=>`<option value="${esc(value)}">${esc(statusLabel(value))}</option>`).join('');
    ready=true;node('patient-registry-status').textContent='Hospital consultations · Cancelled bookings excluded';render();
  }catch(error){if(signal.aborted)return;node('patient-registry-status').textContent=error.message;node('patient-registry-status').dataset.error='true';rows.innerHTML='<tr><td colspan="6" class="dr-empty">Unable to load your patient registry. '+esc(error.message)+'</td></tr>';}})();
})();
