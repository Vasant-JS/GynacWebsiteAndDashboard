(function(){
  if(window.DoctorPage)return;
  let controller=new AbortController(),guards=[];
  const page={
    get signal(){return controller.signal;},
    guard(check){guards.push(check);},
    canLeave(){const states=guards.map(check=>check());if(states.some(state=>state.busy)){alert('Please wait for saving to finish.');return false;}return !states.some(state=>state.dirty)||confirm('Discard unsaved changes and leave this page?');},
    reset(){controller.abort();controller=new AbortController();guards=[];},
    navigate(url){if(window.navigateDoctorPage)return window.navigateDoctorPage(url);location.assign(url);}
  };
  window.addEventListener('beforeunload',event=>{if(guards.some(check=>{const state=check();return state.dirty||state.busy;})){event.preventDefault();event.returnValue='';}});
  window.DoctorPage=page;
})();
