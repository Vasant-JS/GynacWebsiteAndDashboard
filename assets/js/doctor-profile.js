(function(){
  const pageRoot=document.querySelector('.aura-page');
  const pageSignal=window.DoctorPage.signal;
  const pageFetch=(url,options={})=>fetch(url,{signal:pageSignal,...options});
  const pageDocument={getElementById:id=>pageRoot.querySelector('[id="'+CSS.escape(id)+'"]'),querySelector:selector=>pageRoot.querySelector(selector),querySelectorAll:selector=>pageRoot.querySelectorAll(selector)};
  const status = pageDocument.getElementById('doctor-profile-status');
  if (!status) return;
  const form = pageDocument.getElementById('doctor-profile-edit');
  const saveMessage = pageDocument.getElementById('doctor-profile-save-message');
  let loaded = false;

  function setText(id, value) {
    const node = pageDocument.getElementById(id);
    if (node) node.textContent = value || '-';
  }

  function readStoredUser() {
    try {
      const user = JSON.parse(localStorage.getItem('auraSessionUser_DOCTOR') || localStorage.getItem('auraSessionUser') || 'null');
      return user && user.role === 'DOCTOR' ? user : null;
    } catch (_error) {
      return null;
    }
  }

  function renderProfile(user, sourceLabel) {
    const profile = user.profile || {};
    const title = profile.title || profile.designation || profile.specialization || 'Care dashboard';
    status.textContent = sourceLabel;
    setText('doctor-profile-name', user.displayName || user.display_name || 'Doctor');
    setText('doctor-profile-title', title);
    setText('doctor-profile-email', user.email);
    setText('doctor-profile-specialization', profile.specialization);
    setText('doctor-profile-experience', profile.experienceYears != null ? `${profile.experienceYears} years` : 'Not provided');
    setText('doctor-profile-fee', profile.consultationFee ? `INR ${profile.consultationFee}` : '-');
    setText('doctor-profile-languages', Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages);
    if (form) { form.elements.experienceYears.value=profile.experienceYears ?? ''; form.elements.languages.value=(profile.languages || []).join(', '); }
  }

  async function loadProfile() {
    status.innerHTML = '<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>Loading profile...</span></span>';
    const storedUser = readStoredUser();
    if (storedUser) renderProfile(storedUser, 'Loaded from login profile');
    try {
      const response = await pageFetch('/api/doctor/profile', {cache:'no-store'});
      const data = await response.json();
      const user = data.user;
      if (!response.ok || !user || user.role !== 'DOCTOR') throw new Error('Doctor session not found.');
      localStorage.setItem('auraSessionUser_DOCTOR', JSON.stringify(user));
      renderProfile(user, 'Your doctor profile');
      loaded=true; if(form)form.querySelector('button').disabled=false;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  form?.addEventListener('submit',async event=>{
    event.preventDefault();if(!loaded)return;
    const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;saveMessage.textContent='Saving…';
    try {
      const response=await pageFetch('/api/doctor/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({experienceYears:form.elements.experienceYears.value,languages:form.elements.languages.value.split(',').map(value=>value.trim()).filter(Boolean)})});
      const data=await response.json();if(!response.ok)throw new Error(data.message || 'Unable to save profile.');
      localStorage.setItem('auraSessionUser_DOCTOR',JSON.stringify(data.user));renderProfile(data.user,'Your doctor profile');saveMessage.textContent=data.message;
    } catch(error){saveMessage.textContent=error.message;}finally{button.disabled=false;}
  });
  loadProfile();
})();
