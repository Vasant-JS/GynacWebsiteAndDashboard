const test = require('node:test');
const assert = require('node:assert/strict');
const { createConsultationMeeting, syncConsultationMeeting, refreshConsultationMeeting, safeMeetLink } = require('../server/meeting');
test('Calendar creation, conference refresh, reschedule and cancellation', async () => {
  const originalFetch=global.fetch, originalToken=process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  process.env.GOOGLE_CALENDAR_ACCESS_TOKEN='test-token';
  const calls=[]; let pending=true, failed=false;
  global.fetch=async (url,options) => {
    calls.push({url:String(url),...options});
    if (failed) return new Response(JSON.stringify({error:{message:'error'}}),{status:503});
    if (options.method==='DELETE') return new Response(null,{status:204});
    if (options.method==='POST' && pending) {pending=false;return Response.json({id:'test-event',conferenceData:{createRequest:{status:{statusCode:'pending'}}}});}
    return Response.json({id:'test-event',hangoutLink:'https://meet.google.com/abc-defg-hij'});
  };
  try {
    const meeting=await createConsultationMeeting({appointmentId:'test',appointmentAt:'2030-01-01T10:00:00+05:30',durationMinutes:30,patient:{},doctor:{},notify:false});
    assert.equal(meeting.mode,'created');assert.equal(meeting.calendarEventId,'test-event');assert.ok(meeting.calendarId);
    assert.ok(calls[0].url.includes('sendUpdates=none'));assert.equal(calls[1].method,'GET');
    assert.equal((await refreshConsultationMeeting(meeting)).meetLink,meeting.meetLink);
    const appointment={duration_minutes:30,metadata:{virtualMeeting:meeting}};
    const moved=await syncConsultationMeeting(appointment,{appointmentAt:'2030-01-02T10:00:00+05:30'});
    const patch=calls.find(call=>call.method==='PATCH');
    assert.ok(patch.url.includes('sendUpdates=all'));assert.equal(JSON.parse(patch.body).start.dateTime,'2030-01-02T04:30:00.000Z');
    assert.equal(JSON.parse(patch.body).end.dateTime,'2030-01-02T05:00:00.000Z');assert.equal(moved.meetLink,meeting.meetLink);
    assert.equal((await syncConsultationMeeting(appointment,{cancel:true})).meetLink,null);
    failed=true;await assert.rejects(syncConsultationMeeting(appointment,{appointmentAt:'2030-01-03'}),/synchronize/);
    assert.equal(safeMeetLink('https://evil.example/'),null);assert.equal(safeMeetLink('javascript:alert(1)'),null);
    global.fetch=async()=>new Response('{}',{status:410});
    assert.equal((await syncConsultationMeeting(appointment,{cancel:true})).mode,'cancelled');
  } finally {global.fetch=originalFetch;if(originalToken===undefined)delete process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;else process.env.GOOGLE_CALENDAR_ACCESS_TOKEN=originalToken;}
});
