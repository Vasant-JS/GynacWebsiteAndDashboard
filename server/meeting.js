const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60_000).toISOString();
}

async function getAccessToken() {
  if (process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) return process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) return null;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Google OAuth token refresh failed.');
  return data.access_token;
}

async function createConsultationMeeting({ appointmentId, appointmentAt, durationMinutes = 15, serviceType, patient, doctor, notify = true }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { provider: 'google_meet', mode: 'not_configured', meetLink: null, createdAt: new Date().toISOString() };
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const calendarUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=${notify ? 'all' : 'none'}`;
  const attendees = [patient.email, doctor.email]
    .filter((email, index, list) => email && list.indexOf(email) === index)
    .map((email) => ({ email }));
  const event = {
    summary: `${serviceType || 'Consultation'} – ${patient.display_name || 'Patient'} and ${doctor.display_name || 'Doctor'}`,
    description: `Sumohan Care consultation. Appointment ID: ${appointmentId}`,
    start: { dateTime: new Date(appointmentAt).toISOString(), timeZone: process.env.APPOINTMENT_TIME_ZONE || 'Asia/Kolkata' },
    end: { dateTime: addMinutes(appointmentAt, durationMinutes), timeZone: process.env.APPOINTMENT_TIME_ZONE || 'Asia/Kolkata' },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: `sumohan-${appointmentId}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const response = await fetch(calendarUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  let data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Google Calendar could not create the consultation event.');
  for (let attempt = 0; attempt < 3 && data.conferenceData?.createRequest?.status?.statusCode === 'pending'; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    try { data = await calendarRequest({ calendarId, calendarEventId: data.id }, 'GET', undefined, accessToken); }
    catch (_) { break; } // Preserve the event ID so a pending conference can be refreshed on join.
  }
  const meetLink = safeMeetLink(data.hangoutLink || data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri);
  return {
    provider: 'google_meet',
    mode: meetLink ? 'created' : 'conference_pending',
    meetLink,
    calendarEventId: data.id,
    calendarId,
    calendarHtmlLink: data.htmlLink,
    createdAt: new Date().toISOString(),
  };
}

function safeMeetLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'meet.google.com' && !url.username && !url.password ? url.href : null; } catch (_) { return null; }
}

async function calendarRequest(meeting, method, body, token, notify = true) {
  const accessToken = token || await getAccessToken();
  if (!accessToken) throw new Error('Google Calendar is not configured. Contact the hospital to update this appointment.');
  const calendarId = meeting.calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary';
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(meeting.calendarEventId)}?conferenceDataVersion=1&sendUpdates=${notify ? 'all' : 'none'}`, {
    method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  if (method === 'DELETE' && [204,404,410].includes(response.status)) return {};
  const data = await response.json();
  if (!response.ok) throw new Error('Google Calendar could not synchronize this appointment. Please try again or contact the hospital.');
  return data;
}

async function refreshConsultationMeeting(meeting) {
  if (!meeting?.calendarEventId) return meeting;
  const data = await calendarRequest(meeting, 'GET');
  const meetLink = data.status === 'cancelled' ? null : safeMeetLink(data.hangoutLink || data.conferenceData?.entryPoints?.find(item => item.entryPointType === 'video')?.uri);
  return { ...meeting, meetLink, mode: data.status === 'cancelled' ? 'cancelled' : meetLink ? 'created' : 'conference_pending' };
}

async function syncConsultationMeeting(appointment, { cancel = false, appointmentAt, notify = true } = {}) {
  const meeting = appointment.metadata?.virtualMeeting;
  if (!meeting?.calendarEventId) return meeting || null;
  if (cancel) {
    await calendarRequest(meeting, 'DELETE', undefined, undefined, notify);
    return { ...meeting, mode: 'cancelled', meetLink: null, syncedAt: new Date().toISOString() };
  }
  const data = await calendarRequest(meeting, 'PATCH', {
    start: { dateTime: new Date(appointmentAt).toISOString(), timeZone: process.env.APPOINTMENT_TIME_ZONE || 'Asia/Kolkata' },
    end: { dateTime: addMinutes(appointmentAt, appointment.duration_minutes || 15), timeZone: process.env.APPOINTMENT_TIME_ZONE || 'Asia/Kolkata' },
  }, undefined, notify);
  return { ...meeting, meetLink: safeMeetLink(data.hangoutLink) || meeting.meetLink, syncedAt: new Date().toISOString() };
}

module.exports = { createConsultationMeeting, syncConsultationMeeting, refreshConsultationMeeting, safeMeetLink };
