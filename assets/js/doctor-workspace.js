(function(){
  if(window.DoctorWorkspace)return;
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function api(path,options){const response=await fetch('/api/doctor/'+path,{cache:'no-store',signal:window.DoctorPage?.signal,...options});const data=await response.json();if(!response.ok)throw new Error(data.message || 'Unable to load this record.');return data;}
  const date=(value,full=false)=>value?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',...(full?{dateStyle:'medium',timeStyle:'short'}:{dateStyle:'medium'})}).format(new Date(value)):'Not recorded';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function status(node,text,error=false){if(!node)return;node.textContent=text;node.dataset.error=String(error);}
  async function picker(node,selected,page){
    if(!node)return;
    const data=await api('patients/lists');const visits=[...data.current,...data.future,...data.past].sort((a,b)=>new Date(b.appointmentAt)-new Date(a.appointmentAt));
    node.innerHTML='<option value="">Choose a consultation…</option>'+visits.map(visit=>`<option value="${esc(visit.appointmentId)}">${esc(visit.patient.name)} · ${esc(date(visit.appointmentAt))} · ${esc(visit.serviceType)}</option>`).join('');
    node.value=selected || '';
    node.addEventListener('change',()=>{if(node.value)window.DoctorPage.navigate(page+'?appointmentId='+encodeURIComponent(node.value));});
  }
  function printDocument(title,html){const popup=window.open('','_blank');if(!popup)throw new Error('Allow the print window to open, then try again.');popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px Arial,sans-serif;color:#182b27;margin:30px}h1{font-size:23px;color:#00504a}h2{font-size:17px;margin-top:24px}p{line-height:1.6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd9d3;padding:9px;text-align:left;vertical-align:top}dl{display:grid;grid-template-columns:1fr 1.5fr;gap:9px}dt{font-weight:bold}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}section{break-inside:avoid}button{padding:10px}@media print{button{display:none}}@page{margin:16mm}</style></head><body>${html}<button onclick="window.print()">Print / Save as PDF</button></body></html>`);popup.document.close();}
  window.DoctorWorkspace={esc,api,date,today,status,picker,printDocument};
})();
