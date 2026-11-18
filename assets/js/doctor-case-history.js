(function(){
  const pageRoot=document.querySelector('.aura-page');
  const pageSignal=window.DoctorPage.signal;
  const pageDocument={getElementById:id=>pageRoot.querySelector('[id="'+CSS.escape(id)+'"]'),querySelector:selector=>pageRoot.querySelector(selector),querySelectorAll:selector=>pageRoot.querySelectorAll(selector)};
  const W=window.DoctorWorkspace,C=window.Clinical,{esc,api,date,status}=W;
  const form=pageDocument.getElementById('dw-case-form'),fields=pageDocument.getElementById('dw-case-fields'),message=pageDocument.getElementById('dw-case-status');
  const id=new URLSearchParams(location.search).get('appointmentId');
  const editorRoute=location.pathname==='/doctor/appointment-details.html';
  let state=null,visit=null,editing=false,dirty=false,saving=false;
  const headings=['Chief Complaints & Current Episode','Obstetric History & Antenatal Profile','Menstrual History','Medical History & Drug Allergies','Family History','Physical Measurements & Clinical Vitals','Provisional Diagnosis & Management Plan'];
  const node=id=>pageDocument.getElementById(id);
  const current=()=>visit?.id===state?.appointment.id;
  const valueText=value=>Array.isArray(value)?value.map(item=>typeof item==='object'?[item.gender,item.age!=null?item.age+' years':'',item.notes].filter(Boolean).join(' · '):item).join('\n'):String(value ?? '');
  function childRow(child={}){return `<div class="dw-child"><label>Gender<select class="dw-input" data-child="gender"><option value="">Not recorded</option>${['Male','Female','Other','Unknown'].map(value=>`<option ${value===child.gender?'selected':''}>${value}</option>`).join('')}</select></label><label>Age (years)<input class="dw-input" data-child="age" type="number" min="0" max="120" step="0.1" value="${esc(child.age ?? '')}"></label><label>Notes<input class="dw-input" data-child="notes" maxlength="1000" value="${esc(child.notes || '')}"></label><button class="dw-button dw-button--light" data-remove-child type="button" aria-label="Remove child row">Remove</button></div>`;}
  function fieldMarkup(field){
    const value=visit.data?.[field.key],text=valueText(value);
    if(!editing)return `<div class="dw-field ${field.type==='textarea'||field.type==='children'?'dw-field--wide':''}" data-clinical="${field.key}"><span>${esc(field.label)}</span><p class="dw-value ${text?'':'dw-value--empty'}">${esc(text || 'Not recorded')}</p></div>`;
    const attr=`name="${field.key}" class="dw-input"`;
    let control;
    if(field.type==='children')control=`<div id="dw-children">${(value || []).map(childRow).join('')}</div><button class="dw-button dw-button--light" id="dw-add-child" type="button">Add child</button>`;
    else if(field.type==='multi')control=`<div class="dw-options">${field.options.map(option=>`<label><input type="checkbox" name="${field.key}" value="${esc(option)}" ${(value || []).includes(option)?'checked':''}>${esc(option)}</label>`).join('')}</div>`;
    else if(field.type==='textarea')control=`<textarea ${attr} maxlength="10000" rows="3">${esc(value || '')}</textarea>`;
    else if(field.type==='select')control=`<select ${attr}><option value="">Not recorded</option>${field.options.map(option=>`<option ${option===value?'selected':''}>${esc(option)}</option>`).join('')}</select>`;
    else control=`<input ${attr} type="${field.type}" value="${esc(value ?? (field.key==='assessmentDate'?C.today():''))}" ${field.type==='number'?`min="${field.min}" max="${field.max}" step="any"`:'maxlength="10000"'}>`;
    return `<div class="dw-field ${['textarea','children','multi'].includes(field.type)?'dw-field--wide':''}" data-clinical="${field.key}">${['children','multi'].includes(field.type)?`<span>${esc(field.label)}</span>`:`<label for="dw-clinical-${field.key}">${esc(field.label)}</label>`}<div>${control.replace(/name="([^"]+)" class/,`id="dw-clinical-${field.key}" name="$1" class`)}</div></div>`;
  }
  function collect(){if(!editing)return visit.data || {};const data={};for(const field of C.fields){if(field.type==='children')data.children=[...form.querySelectorAll('.dw-child')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-child]')].map(input=>[input.dataset.child,input.value])));else if(field.type==='multi')data[field.key]=[...form.querySelectorAll(`[name="${field.key}"]:checked`)].map(input=>input.value);else data[field.key]=form.elements[field.key].value;}return data;}
  function snapshot(data={}){return C.sections.map(section=>`<section><h3>${esc(section.title)}</h3><dl>${section.fields.map(field=>`<dt>${esc(field.label)}</dt><dd>${esc(valueText(data[field.key]) || 'Not recorded')}</dd>`).join('')}</dl></section>`).join('');}
  function updateCalculations(){const data=collect(),calc=C.calculations(data);node('dw-pog').textContent=calc.gestationWeeks==null?'Not recorded':`${calc.gestationWeeks}w ${calc.gestationDays}d`;node('dw-edd').textContent=calc.dueDate?date(calc.dueDate+'T00:00:00+05:30'):'Not recorded';node('dw-gpal').textContent=data.gpal || 'Not recorded';node('dw-case-bmi').textContent=calc.bmi ?? 'Not recorded';node('dw-patient-blood').textContent=data.bloodGroup?[data.bloodGroup,data.rh].filter(Boolean).join(' '):(state.appointment.profile?.bloodType || state.appointment.profile?.blood_type || state.appointment.profile?.bloodGroup || 'Not recorded');
    for(const field of C.fields.filter(item=>item.showWhen)){const wrapper=form.querySelector(`[data-clinical="${field.key}"]`);wrapper.hidden=data[field.showWhen[0]]!==field.showWhen[1] || (field.key==='ictResult' && data.rh!=='Negative');}
    node('dw-risk-details').innerHTML=[['Blood group',[data.bloodGroup,data.rh].filter(Boolean).join(' ')],['High-risk pregnancy',data.highRisk],['Anti-D administered',data.antiD],['ICT performed',data.ictPerformed],['ICT result',data.ictResult]].map(([label,value])=>`<div class="dw-record"><p class="dw-muted">${label}</p><strong style="font-size:12px">${esc(value || 'Not recorded')}</strong></div>`).join('');
  }
  function render(){
    const patient=state.appointment,profile=patient.profile || {};
    node('dw-case-content').hidden=false;node('dw-patient-name').textContent=patient.patient_name;node('dw-patient-case-id').textContent='Case ID: '+state.caseId;
    node('dw-patient-status').textContent=visit.status.replaceAll('_',' ');
    node('dw-patient-demographics').textContent=[profile.age!=null?profile.age+' years':'',profile.gender || profile.sex].filter(Boolean).join(' / ') || 'Not recorded';
    node('dw-patient-contact').textContent=patient.patient_phone || patient.patient_email || 'Not recorded';
    const lastVisit=state.history.find(item=>new Date(item.appointment_at)<=new Date());
    node('dw-patient-last-visit').textContent=lastVisit?date(lastVisit.appointment_at):'Not recorded';
    for(const [key,href] of [['dw-patient-email',patient.patient_email?'mailto:'+patient.patient_email:''],['dw-patient-phone',patient.patient_phone?'tel:'+patient.patient_phone:'']]){const link=node(key);if(href)link.href=href;else link.removeAttribute('href');link.setAttribute('aria-disabled',String(!href));link.title=href?(key.endsWith('email')?'Email patient':'Call patient'):'Contact not recorded';}

    node('dw-encounter-status').textContent=`${visit.service_type} · ${visit.status.replaceAll('_',' ')} · ${date(visit.appointment_at,true)}`;
    node('dw-physician').textContent='Attended by: '+(visit.doctor_name || patient.doctor_name || 'Not yet attended');
    node('dw-revision-tag').textContent=visit.version?'Saved revision '+visit.version:'No saved case sheet';
    node('dw-booking-reason').textContent='Reason for visit: '+[visit.notes?.reason,visit.notes?.otherReason].filter(Boolean).join(' · ');
    node('dw-case-notes').value=visit.notes?.observations || '';node('dw-case-actions').value=(visit.notes?.recommendedActions || []).join('\n');node('dw-case-notes').disabled=node('dw-case-actions').disabled=!editing;
    node('dw-case-rx').href='/doctor/prescription.html?appointmentId='+encodeURIComponent(patient.id);node('dw-case-encounter').href=(editorRoute?'/doctor/case-history.html':'/doctor/appointment-details.html')+'?appointmentId='+encodeURIComponent(patient.id);node('dw-case-encounter').textContent=editorRoute?'View Saved Case History':'Open Consultation Editor';
    node('dw-case-attend').hidden=!current()||!state.canAttend;node('dw-case-edit').hidden=editing || !current() || !state.canEdit;node('dw-case-save').hidden=!editing;node('dw-case-cancel').hidden=!editing;
    const closed=['COMPLETED','CANCELLED'].includes(patient.status),canComplete=current()&&state.canEdit&&!closed;
    node('dw-case-complete').hidden=!canComplete;
    const meeting=patient.metadata?.virtualMeeting,hasMeeting=meeting?.meetLink || meeting?.calendarEventId,canJoin=current()&&state.canEdit&&!closed&&hasMeeting;
    node('dw-case-meet').hidden=!hasMeeting;
    if(canJoin)node('dw-case-meet').href='/api/consultations/'+encodeURIComponent(patient.id)+'/join?role=DOCTOR';else node('dw-case-meet').removeAttribute('href');
    node('dw-case-meet').setAttribute('aria-disabled',String(!canJoin));
    node('dw-case-meet-status').textContent=closed?'Google Meet is unavailable for completed or cancelled appointments.':!state.canEdit?(state.canAttend?'Attend this appointment to access consultation controls.':'Consultation controls are unavailable for this appointment.'):!hasMeeting?'No Google Meet link is saved for this appointment.':'';
    node('dw-case-edit-help').textContent=!current()?'Past visit snapshot. Select the current consultation to edit its case sheet.':state.canEdit?'Changes are saved as a new revision. Nothing is automatically saved.':'This consultation is read only.';
    node('dw-viewing-visit').hidden=current();node('dw-viewing-visit').innerHTML=`Viewing history from ${esc(date(visit.appointment_at))}. <button class="dw-button dw-button--light" type="button" id="dw-return-current">Return to selected consultation</button>`;
    node('dw-viewing-visit').querySelector('button').onclick=()=>selectVisit(currentVisit());
    fields.innerHTML=C.sections.map((section,index)=>`<details class="dw-card dw-clinical-group" id="dw-group-${index}" ${index<2?'open':''}><summary><span>${String(index+1).padStart(2,'0')}</span><div><h2>${headings[index]}</h2><p class="dw-muted">${esc(section.title)}</p></div></summary><div class="dw-fields">${section.fields.map(fieldMarkup).join('')}</div>${index===1?'<div class="dw-calculations"><p class="dw-muted">LMP estimate assumes a 28-day cycle unless adjusted. Confirm dating clinically.</p></div>':''}${index===5?'<div class="dw-calculations"><div>BMI (kg/m²)<strong id="dw-case-bmi">Not recorded</strong></div></div>':''}</details>`).join('');
    node('dw-case-anchors').innerHTML=C.sections.map((section,index)=>`<a href="#dw-group-${index}">${index+1}. ${esc(section.title)}</a>`).join('');
    node('dw-case-documents').innerHTML=state.documents.map(doc=>`<article class="dw-record"><h3>${esc(doc.name)}</h3><p class="dw-muted">${esc(date(doc.document_date || doc.created_at))} · ${esc(doc.document_type.replaceAll('_',' '))}${doc.appointment_id===visit.id?' · This consultation':''}</p><div class="dw-actions"><a class="dw-button dw-button--light" href="/api/doctor/documents/${encodeURIComponent(doc.id)}/view" target="_blank" rel="noopener">View</a><a class="dw-button dw-button--light" href="/api/doctor/documents/${encodeURIComponent(doc.id)}/download">Download</a></div></article>`).join('') || '<p class="dw-muted">No uploaded reports.</p>';
    node('dw-case-prescriptions').innerHTML=state.prescriptions.map(rx=>`<article class="dw-record"><h3>${esc(date(rx.created_at,true))} · ${esc(rx.status)}</h3><p class="dw-muted">${rx.appointment_id===visit.id?'This consultation':'Previous consultation'}</p>${(rx.medications || []).map(med=>`<p>${esc([med.name,med.dosage,med.frequency,med.duration,med.instructions].filter(Boolean).join(' · '))}</p>`).join('')}<p>${esc(rx.instructions?.advice || '')}</p>${rx.instructions?.followUpDate?`<p>Follow-up: ${esc(rx.instructions.followUpDate)}</p>`:''}</article>`).join('') || '<p class="dw-muted">No prescriptions recorded.</p>';
    node('dw-case-timeline').innerHTML=state.history.map(item=>`<article class="dw-history-entry"><strong>${esc(item.service_type)}</strong><p>${esc(date(item.appointment_at))} · ${esc(item.doctor_name)}</p><p class="dw-muted">${esc(item.status.replaceAll('_',' '))}</p><div class="dw-actions"><button class="dw-button dw-button--light" type="button" data-history-visit="${item.id}">View history</button>${item.doctor_id===patient.doctor_id?`<a class="dw-button dw-button--light" href="/doctor/case-history.html?appointmentId=${item.id}">Open visit</a>`:''}</div></article>`).join('') || '<p>No previous visits.</p>';
    node('dw-case-revisions').innerHTML=state.revisions.map(revision=>`<details class="dw-history-entry"><summary>Version ${revision.version} · ${esc(date(revision.created_at,true))} · ${esc(revision.doctor_name)}</summary>${snapshot(revision.data)}</details>`).join('') || '<p class="dw-muted" style="margin-top:18px">No saved revisions yet.</p>';
    updateCalculations();
  }
  function currentVisit(){return {...state.appointment,data:state.sheet?.data || {},version:state.sheet?.version || 0};}
  function canDiscard(){return !dirty || confirm('Discard unsaved changes?');}
  function selectVisit(item){if(!canDiscard())return;visit=item;editing=editorRoute&&current()&&state.canEdit;dirty=false;render();status(message,current()?'Selected consultation loaded.':'Viewing a saved patient-history snapshot.');}
  async function load(){status(message,'Loading case history…');state=await api(`appointments/${encodeURIComponent(id)}/case-history`);if(pageSignal.aborted)return;visit=currentVisit();editing=editorRoute&&state.canEdit;dirty=false;render();status(message,'Patient history loaded.');}
  node('dw-case-attend').onclick=async()=>{saving=true;node('dw-case-attend').disabled=true;try{await api('appointments/'+encodeURIComponent(id)+'/attend',{method:'POST'});await load();status(message,'Attendance recorded. You can now edit this case sheet.');}catch(error){status(message,error.message,true);}finally{saving=false;node('dw-case-attend').disabled=false;}};
  node('dw-case-edit').onclick=()=>{editing=true;render();status(message,'Editing case sheet. Save when ready.');};
  node('dw-case-cancel').onclick=()=>{if(canDiscard()){editing=false;dirty=false;render();status(message,'Edits discarded.');}};
  node('dw-case-reload').onclick=()=>{if(canDiscard())load().catch(error=>status(message,error.message,true));};
  node('dw-expand').onclick=()=>fields.querySelectorAll('details').forEach(item=>item.open=true);node('dw-collapse').onclick=()=>fields.querySelectorAll('details').forEach(item=>item.open=false);
  const sectionBar=node('dw-section-bar'),sectionNav=node('dw-case-anchors');
  function syncStickyOffsets(){
    const header=document.querySelector('.doctor-topbar');
    pageRoot.style.setProperty('--dw-sticky-top',(header?.getBoundingClientRect().height || 0)+'px');
    pageRoot.style.setProperty('--dw-section-bar-height',sectionBar.getBoundingClientRect().height+'px');
  }
  const sectionResize=new ResizeObserver(syncStickyOffsets);
  sectionResize.observe(sectionBar);
  const header=document.querySelector('.doctor-topbar');if(header)sectionResize.observe(header);
  window.addEventListener('doctor-topbar-ready',()=>{
    const readyHeader=document.querySelector('.doctor-topbar');if(readyHeader)sectionResize.observe(readyHeader);
    syncStickyOffsets();
  },{signal:pageSignal});
  pageSignal.addEventListener('abort',()=>sectionResize.disconnect(),{once:true});
  sectionNav.onclick=event=>{
    const link=event.target.closest('a[href^="#dw-group-"]');if(!link)return;
    event.preventDefault();event.stopPropagation();
    const group=node(link.hash.slice(1));if(!group)return;
    group.open=true;syncStickyOffsets();
    sectionNav.querySelectorAll('a').forEach(item=>{if(item===link)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current');});
    group.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  node('dw-case-timeline').onclick=event=>{const button=event.target.closest('[data-history-visit]');if(button){const selected=state.history.find(item=>item.id===button.dataset.historyVisit);if(selected)selectVisit(selected);}};
  form.addEventListener('input',()=>{dirty=true;status(message,'Unsaved changes');updateCalculations();});form.addEventListener('change',updateCalculations);
  form.addEventListener('click',event=>{if(event.target.closest('#dw-add-child')){if(form.querySelectorAll('.dw-child').length>=30)return;node('dw-children').insertAdjacentHTML('beforeend',childRow());dirty=true;}if(event.target.closest('[data-remove-child]')){event.target.closest('.dw-child').remove();dirty=true;}});
  async function saveCase(complete=false){
    if(!current()||!state.canEdit||saving)return;
    if(!editing&&!complete)return;
    saving=true;node('dw-case-save').disabled=node('dw-case-complete').disabled=true;
    try{
      const data=C.normalize(collect()),consultationNotes={observations:node('dw-case-notes').value,recommendedActions:node('dw-case-actions').value.split('\n').map(item=>item.trim()).filter(Boolean)};
      status(message,'Saving case sheet…');
      const result=await api('appointments/'+encodeURIComponent(id)+'/case-history',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,version:state.sheet?.version || 0,consultationNotes})});
      state.sheet=result.sheet;visit={...visit,data:result.sheet.data,version:result.sheet.version,notes:{...(visit.notes || {}),...consultationNotes}};dirty=false;
      if(complete)await api('appointments/'+encodeURIComponent(id)+'/notes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...consultationNotes,status:'COMPLETED'})});
      await load();status(message,complete?'Case sheet saved and appointment completed.':'Case sheet saved · Version '+result.sheet.version);
    }catch(error){status(message,error.message,true);}finally{saving=false;node('dw-case-save').disabled=node('dw-case-complete').disabled=false;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();saveCase();});
  node('dw-case-complete').onclick=()=>saveCase(true);
  for(const key of ['dw-case-notes','dw-case-actions'])node(key).addEventListener('input',()=>{dirty=true;status(message,'Unsaved changes');});
  const dialog=node('dw-audit-dialog');node('dw-audit').onclick=()=>dialog.showModal();node('dw-audit-close').onclick=()=>dialog.close();
  node('dw-case-print').onclick=()=>{try{const data=collect(),calc=C.calculations(data);W.printDocument('Clinical Case Sheet',`<h1>Sumohan Care · Clinical Case Sheet</h1><p>${esc(state.appointment.patient_name)}<br>${esc(state.caseId)}<br>${esc(date(visit.appointment_at,true))} · ${esc(visit.doctor_name || state.appointment.doctor_name)}<br>${dirty?'Current form contains unsaved changes':'Saved revision '+(visit.version || 0)}</p>${snapshot(data)}<h3>Consultation notes</h3><p>${esc(node('dw-case-notes').value || 'Not recorded')}</p><h3>Recommended actions</h3><p>${esc(node('dw-case-actions').value || 'Not recorded')}</p><p>EDD: ${esc(calc.dueDate || 'Not recorded')} · Gestation: ${calc.gestationWeeks==null?'Not recorded':calc.gestationWeeks+'w '+calc.gestationDays+'d'} · BMI: ${esc(calc.bmi ?? 'Not recorded')}</p>`);}catch(error){status(message,error.message,true);}};
  window.DoctorPage.guard(()=>({dirty,busy:saving}));
  W.picker(node('dw-visit-picker'),id,location.pathname).catch(error=>status(message,error.message,true));
  if(id)load().catch(error=>{node('dw-case-content').hidden=true;status(message,error.message,true);});
})();
