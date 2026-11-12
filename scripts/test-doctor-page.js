const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  let beforeUnload,answer=false,confirmations=0;
  const window={addEventListener(name,handler){if(name==='beforeunload')beforeUnload=handler;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/doctor-page.js'),'utf8'),{
    window,AbortController,confirm:()=>{confirmations++;return answer;},alert:()=>{},location:{assign(){}}
  });
  return {page:window.DoctorPage,answer(value){answer=value;},confirmations:()=>confirmations,unload:()=>beforeUnload};
}

test('dirty pages prompt before routing; saving pages cannot be left',()=>{
  const app=setup();assert.equal(app.page.canLeave(),true);
  let dirty=true,busy=false;
  app.page.guard(()=>({dirty,busy}));
  assert.equal(app.page.canLeave(),false);
  app.answer(true);assert.equal(app.page.canLeave(),true);
  busy=true;assert.equal(app.page.canLeave(),false);
  assert.equal(app.confirmations(),2);
  let prevented=false;
  app.unload()({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  dirty=false;busy=false;assert.equal(app.page.canLeave(),true);
});

test('switching pages removes old guards and aborts old global listeners',()=>{
  const app=setup(),oldSignal=app.page.signal;
  let events=0;
  const target=new EventTarget();
  target.addEventListener('context',()=>events++,{signal:oldSignal});
  app.page.guard(()=>({dirty:true}));
  app.page.reset();
  target.dispatchEvent(new Event('context'));
  assert.equal(events,0);assert.equal(oldSignal.aborted,true);
  assert.equal(app.page.signal.aborted,false);assert.notEqual(app.page.signal,oldSignal);
  assert.equal(app.page.canLeave(),true);
});
