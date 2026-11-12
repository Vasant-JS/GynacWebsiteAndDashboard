(function(){
  const pageRoot=document.querySelector('.aura-page');
  const pageSignal=window.DoctorPage.signal;
  const pageDocument={getElementById:id=>pageRoot.querySelector('[id="'+CSS.escape(id)+'"]'),querySelector:selector=>pageRoot.querySelector(selector),querySelectorAll:selector=>pageRoot.querySelectorAll(selector)};
  const W=window.DoctorWorkspace,C=window.Clinical,{esc,api,date,status}=W;
  const form=pageDocument.getElementById('dw-case-form'),fields=pageDocument.getElementById('dw-case-fields'),message=pageDocument.getElementById('dw-case-status');
  const id=new URLSearchParams(location.search).get('appointmentId');
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
  function updateCalculations(){const data=collect(),calc=C.calculations(data);node('dw-pog').textContent=calc.gestationWeeks==null?'Not recorded':`${calc.gestationWeeks}w ${calc.gestationDays}d`;node('dw-edd').textContent=calc.dueDate?date(calc.dueDate+'T00:00:00+05:30'):'Not recorded';node('dw-gpal').textContent=data.gpal || 'Not recorded';node('dw-case-bmi').textContent=calc.bmi ?? 'Not recorded';
    for(const field of C.fields.filter(item=>item.showWhen)){const wrapper=form.querySelector(`[data-clinical="${field.key}"]`);wrapper.hidden=data[field.showWhen[0]]!==field.showWhen[1] || (field.key==='ictResult' && data.rh!=='Negative');}
    node('dw-risk-details').innerHTML=[['Blood group',[data.bloodGroup,data.rh].filter(Boolean).join(' ')],['High-risk pregnancy',data.highRisk],['Anti-D administered',data.antiD],['ICT performed',data.ictPerformed],['ICT result',data.ictResult]].map(([label,value])=>`<div class="dw-record"><p class="dw-muted">${label}</p><strong style="font-size:12px">${esc(value || 'Not recorded')}</strong></div>`).join('');
  }
  function render(){
    const patient=state.appointment,profile=patient.profile || {};
    node('dw-case-content').hidden=false;node('dw-patient-name').textContent=patient.patient_name;node('dw-patient-case-id').textContent='Case ID: '+state.caseId;
    node('dw-patient-meta').textContent=[profile.age!=null?profile.age+' years':'',profile.gender,patient.patient_phone || patient.patient_email].filter(Boolean).join(' · ');
    node('dw-encounter-status').textContent=`${visit.service_type} · ${visit.status.replaceAll('_',' ')} · ${date(visit.appointment_at,true)}`;
    node('dw-physician').textContent='Attended by: '+(visit.doctor_name || patient.doctor_name || 'Not yet attended');
    node('dw-revision-tag').textContent=visit.version?'Saved revision '+visit.version:'No saved case sheet';
    node('dw-case-notes').textContent=visit.notes?.observations || visit.notes?.reason || 'No consultation notes recorded.';
    node('dw-case-rx').href='/doctor/prescription.html?appointmentId='+encodeURIComponent(patient.id);node('dw-case-encounter').href='/doctor/appointment-details.html?appointmentId='+encodeURIComponent(patient.id);
    node('dw-case-attend').hidden=!current()||!state.canAttend;node('dw-case-edit').hidden=editing || !current() || !state.canEdit;node('dw-case-save').hidden=!editing;node('dw-case-cancel').hidden=!editing;
    node('dw-case-edit-help').textContent=!current()?'Past visit snapshot. Select the current consultation to edit its case sheet.':state.canEdit?'Changes are saved as a new revision. Nothing is automatically saved.':'This consultation is read only.';
    node('dw-viewing-visit').hidden=current();node('dw-viewing-visit').innerHTML=`Viewing history from ${esc(date(visit.appointment_at))}. <button class="dw-button dw-button--light" type="button" id="dw-return-current">Return to selected consultation</button>`;
    node('dw-viewing-visit').querySelector('button').onclick=()=>selectVisit(currentVisit());
    fields.innerHTML=C.sections.map((section,index)=>`<details class="dw-card dw-clinical-group" id="dw-group-${index}" ${index<2?'open':''}><summary><span>${String(index+1).padStart(2,'0')}</span><div><h2>${headings[index]}</h2><p class="dw-muted">${esc(section.title)}</p></div></summary><div class="dw-fields">${section.fields.map(fieldMarkup).join('')}</div>${index===1?'<div class="dw-calculations"><p class="dw-muted">LMP estimate assumes a 28-day cycle unless adjusted. Confirm dating clinically.</p></div>':''}${index===5?'<div class="dw-calculations"><div>BMI (kg/m²)<strong id="dw-case-bmi">Not recorded</strong></div></div>':''}</details>`).join('');
    node('dw-case-anchors').innerHTML=C.sections.map((section,index)=>`<a href="#dw-group-${index}">${index+1}. ${esc(section.title)}</a>`).join('');
    node('dw-case-documents').innerHTML=state.documents.map(doc=>`<article class="dw-record"><h3>${esc(doc.name)}</h3><p class="dw-muted">${esc(date(doc.document_date || doc.created_at))} · ${esc(doc.document_type.replaceAll('_',' '))}${doc.appointment_id===visit.id?' · This consultation':''}</p><div class="dw-actions"><a class="dw-button dw-button--light" href="/api/doctor/documents/${encodeURIComponent(doc.id)}/view" target="_blank" rel="noopener">View</a><a class="dw-button dw-button--light" href="/api/doctor/documents/${encodeURIComponent(doc.id)}/download">Download</a></div></article>`).join('') || '<p class="dw-muted">No uploaded reports.</p>';
    node('dw-case-timeline').innerHTML=state.history.map(item=>`<article class="dw-history-entry"><strong>${esc(item.service_type)}</strong><p>${esc(date(item.appointment_at))} · ${esc(item.doctor_name)}</p><p class="dw-muted">${esc(item.status.replaceAll('_',' '))}</p><div class="dw-actions"><button class="dw-button dw-button--light" type="button" data-history-visit="${item.id}">View history</button>${item.doctor_id===patient.doctor_id?`<a class="dw-button dw-button--light" href="/doctor/case-history.html?appointmentId=${item.id}">Open visit</a>`:''}</div></article>`).join('') || '<p>No previous visits.</p>';
    node('dw-case-revisions').innerHTML=state.revisions.map(revision=>`<details class="dw-history-entry"><summary>Version ${revision.version} · ${esc(date(revision.created_at,true))} · ${esc(revision.doctor_name)}</summary>${snapshot(revision.data)}</details>`).join('') || '<p class="dw-muted" style="margin-top:18px">No saved revisions yet.</p>';
    updateCalculations();
  }
  function currentVisit(){return {...state.appointment,data:state.sheet?.data || {},version:state.sheet?.version || 0};}
  function canDiscard(){return !dirty || confirm('Discard unsaved changes?');}
  function selectVisit(item){if(!canDiscard())return;visit=item;editing=false;dirty=false;render();status(message,current()?'Selected consultation loaded.':'Viewing a saved patient-history snapshot.');}
  async function load(){status(message,'Loading case history…');state=await api(`appointments/${encodeURIComponent(id)}/case-history`);if(pageSignal.aborted)return;visit=currentVisit();editing=false;dirty=false;render();status(message,'Patient history loaded.');}
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
  form.addEventListener('submit',async event=>{event.preventDefault();if(!editing || !current() || !state.canEdit || saving)return;saving=true;node('dw-case-save').disabled=true;try{const data=C.normalize(collect());status(message,'Saving case sheet…');const result=await api(`appointments/${id}/case-history`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,version:state.sheet?.version || 0})});dirty=false;await load();status(message,`Case sheet saved · Version ${result.sheet.version}`);}catch(error){status(message,error.message,true);}finally{saving=false;node('dw-case-save').disabled=false;}});
  const dialog=node('dw-audit-dialog');node('dw-audit').onclick=()=>dialog.showModal();node('dw-audit-close').onclick=()=>dialog.close();
  node('dw-case-print').onclick=()=>{try{const data=collect(),calc=C.calculations(data);W.printDocument('Clinical Case Sheet',`<h1>Sumohan Care · Clinical Case Sheet</h1><p>${esc(state.appointment.patient_name)}<br>${esc(state.caseId)}<br>${esc(date(visit.appointment_at,true))} · ${esc(visit.doctor_name || state.appointment.doctor_name)}<br>${dirty?'Current form contains unsaved changes':'Saved revision '+(visit.version || 0)}</p>${snapshot(data)}<p>EDD: ${esc(calc.dueDate || 'Not recorded')} · Gestation: ${calc.gestationWeeks==null?'Not recorded':calc.gestationWeeks+'w '+calc.gestationDays+'d'} · BMI: ${esc(calc.bmi ?? 'Not recorded')}</p>`);}catch(error){status(message,error.message,true);}};
  window.DoctorPage.guard(()=>({dirty,busy:saving}));
  W.picker(node('dw-visit-picker'),id,'/doctor/case-history.html').catch(error=>status(message,error.message,true));
  if(id)load().catch(error=>{node('dw-case-content').hidden=true;status(message,error.message,true);});
})();
