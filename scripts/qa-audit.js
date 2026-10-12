/* eslint-disable no-console */
const { chromium } = require('playwright');

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5177';

class ApiClient {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
  }

  storeCookies(response) {
    const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    setCookie.forEach((line) => {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      if (index > -1) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    });
  }

  async request(method, path, body, options = {}) {
    const headers = { ...(options.headers || {}) };
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    let payload = body;
    if (body && !(body instanceof FormData) && !Buffer.isBuffer(body)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: payload,
      redirect: options.redirect || 'manual',
    });
    this.storeCookies(response);
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, ok: response.ok, data, headers: response.headers };
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }
}

const results = [];
const defects = [];
const observations = [];

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function test(name, fn, severity = 'P2') {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, status: 'PASS', ms: Date.now() - started });
  } catch (error) {
    results.push({ name, status: 'FAIL', ms: Date.now() - started, message: error.message });
    defects.push({ severity, name, message: error.message, details: error.details || null });
  }
}

function todayYmd(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthKey(offsetDays = 0) {
  return todayYmd(offsetDays).slice(0, 7);
}

async function findAvailableBookingSlot(client, doctorId, startOffsetDays = 2) {
  const preferredSlots = ['09:00 AM', '09:30 AM', '10:30 AM', '11:00 AM', '01:00 PM', '02:30 PM', '04:00 PM', '06:30 PM', '07:00 PM', '07:30 PM'];
  for (let offset = startOffsetDays; offset < startOffsetDays + 21; offset += 1) {
    const date = todayYmd(offset);
    const availability = await client.get(`/api/patient/booking/availability?doctorId=${encodeURIComponent(doctorId)}&month=${monthKey(offset)}`);
    if (availability.status !== 200) continue;
    const booked = new Set((availability.data.booked || []).filter((item) => item.date === date).map((item) => item.slot));
    const rule = (availability.data.availability || []).find((item) => item.date === date);
    if (rule && !rule.is_available) continue;
    const slots = rule?.slots?.length ? rule.slots : (availability.data.defaultSlots || preferredSlots);
    const slot = slots.find((item) => !booked.has(item));
    if (slot) return { date, time: slot };
  }
  throw new Error('No available QA booking slot found in the next 21 days.');
}

async function main() {
  const stamp = String(Date.now()).slice(-9);
  const qaPatient = {
    name: 'Qa Patient Audit',
    age: 29,
    mobile: `9${stamp}`,
    email: `qa.patient.${stamp}@aura.test`,
    history: 'QA audit history',
    allergies: 'QA audit allergy',
    diabetes: false,
    bloodPressure: true,
  };
  const patient = new ApiClient('patient');
  const combined = new ApiClient('combined-session');
  const doctor = new ApiClient('doctor');
  const admin = new ApiClient('admin');
  let otp;
  let doctors = [];
  let selectedDoctor;
  let appointmentId;
  let paymentId;
  let reportId;

  await test('Public pages load', async () => {
    for (const path of ['/', '/patient/login.html', '/patient/register.html', '/staff/login.html', '/doctor/schedule.html']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert(response.status === 200, `${path} returned ${response.status}`);
    }
  }, 'P1');

  await test('Protected patient API requires login', async () => {
    const anonymous = new ApiClient('anonymous');
    const response = await anonymous.get('/api/patient/dashboard');
    assert(response.status === 401, `Expected 401, got ${response.status}`, response.data);
  }, 'P1');

  await test('Patient login rejects invalid mobile format', async () => {
    const response = await patient.post('/api/auth/patient/request-otp', { phone: '12345' });
    assert(response.status === 400, `Expected 400, got ${response.status}`, response.data);
  }, 'P1');

  await test('Patient login rejects unregistered mobile and asks registration', async () => {
    const response = await patient.post('/api/auth/patient/request-otp', { phone: '9876500000' });
    assert(response.status === 404, `Expected 404, got ${response.status}`, response.data);
    assert(response.data.redirectTo === '/patient/register.html', 'Missing register redirect', response.data);
  }, 'P1');

  await test('Patient registration validates bad fields', async () => {
    const response = await patient.post('/api/auth/patient/register', { name: '1', age: 200, mobile: '111', email: 'bad' });
    assert(response.status === 400, `Expected 400, got ${response.status}`, response.data);
  }, 'P1');

  await test('Patient registration writes to DB', async () => {
    const response = await patient.post('/api/auth/patient/register', qaPatient);
    assert(response.status === 201, `Expected 201, got ${response.status}`, response.data);
    assert(response.data.patient?.email === qaPatient.email, 'Registered patient email mismatch', response.data);
  }, 'P1');

  await test('Registered patient OTP login works', async () => {
    const request = await patient.post('/api/auth/patient/request-otp', { phone: qaPatient.mobile });
    assert(request.status === 200, `Expected OTP 200, got ${request.status}`, request.data);
    otp = request.data.otp;
    assert(/^\d{6}$/.test(otp), 'OTP not returned in dev response', request.data);
    const verify = await patient.post('/api/auth/patient/verify-otp', { phone: qaPatient.mobile, otp });
    assert(verify.status === 200, `Expected verify 200, got ${verify.status}`, verify.data);
    assert(verify.data.redirectTo === '/patient/dashboard.html', 'Patient login redirects to wrong page', verify.data);
  }, 'P1');

  await test('Patient dashboard/profile/reports/appointments APIs load', async () => {
    for (const path of ['/api/patient/dashboard', '/api/patient/profile', '/api/patient/reports', '/api/patient/appointments']) {
      const response = await patient.get(path);
      assert(response.status === 200, `${path} returned ${response.status}`, response.data);
    }
  }, 'P1');

  await test('Patient report upload stores and downloads DB-backed file', async () => {
    const form = new FormData();
    form.append('documentType', 'REPORT');
    form.append('name', `QA Report ${stamp}`);
    form.append('documentDate', todayYmd());
    form.append('uploadedDuring', 'qa_audit');
    form.append('file', new Blob(['QA report content'], { type: 'text/plain' }), `qa-report-${stamp}.txt`);
    const upload = await patient.post('/api/patient/documents', form);
    assert(upload.status === 201, `Expected upload 201, got ${upload.status}`, upload.data);
    reportId = upload.data.document?.id;
    assert(reportId, 'Upload did not return document id', upload.data);
    const download = await patient.get(`/api/patient/documents/${reportId}/download`);
    assert(download.status === 200, `Expected download 200, got ${download.status}`, download.data);
  }, 'P1');

  await test('Patient booking has at least three active doctors', async () => {
    const response = await patient.get('/api/patient/booking/doctors');
    assert(response.status === 200, `Expected doctors 200, got ${response.status}`, response.data);
    doctors = response.data.doctors || [];
    assert(doctors.length >= 3, `Expected at least 3 doctors, found ${doctors.length}`, doctors);
    selectedDoctor = doctors.find((item) => item.email === 'chloe.chen@aura.test') || doctors[0];
  }, 'P1');

  await test('Booking rejects missing reason and past slots', async () => {
    const missing = await patient.post('/api/patient/booking/reason', { reason: '' });
    assert(missing.status === 400, `Expected missing reason 400, got ${missing.status}`, missing.data);
    const past = await patient.post('/api/patient/booking/slot', { date: todayYmd(-1), time: '09:00 AM' });
    assert(past.status === 400, `Expected past slot 400, got ${past.status}`, past.data);
  }, 'P1');

  await test('Patient booking requires payment before appointment insert', async () => {
    let lastPayment = null;
    for (let attempt = 0; attempt < 5 && !appointmentId; attempt += 1) {
      const { date, time } = await findAvailableBookingSlot(patient, selectedDoctor.id, 2 + attempt);
      await patient.post('/api/patient/booking/reason', { reason: 'General Gynecology', service: 'General Gynecology' });
      await patient.post('/api/patient/booking/details', { doctorId: selectedDoctor.id, service: 'General Gynecology', reason: 'QA audit booking' });
      const slot = await patient.post('/api/patient/booking/slot', { date, time });
      assert(slot.status === 200, `Expected slot 200, got ${slot.status}`, slot.data);
      const confirm = await patient.post('/api/patient/booking/confirm', {});
      assert(confirm.status === 402, `Expected confirm 402 before payment, got ${confirm.status}`, confirm.data);
      const payment = await patient.post('/api/patient/booking/payment', { date, time });
      lastPayment = payment;
      if (payment.status === 409) continue;
      assert(payment.status === 201, `Expected payment 201, got ${payment.status}`, payment.data);
      paymentId = payment.data.payment?.id;
      const booked = await patient.patch(`/api/patient/booking/payment/${paymentId}/pay-and-book`, { date, time });
      if (booked.status === 409) continue;
      assert(booked.status === 201, `Expected paid booking 201, got ${booked.status}`, booked.data);
      appointmentId = booked.data.appointment?.id;
    }
    assert(appointmentId, 'Could not book any live-open slot after retries.', lastPayment?.data);
  }, 'P1');

  await test('Staff login rejects wrong doctor password', async () => {
    const response = await doctor.post('/api/auth/staff/login', { role: 'DOCTOR', email: 'chloe.chen@aura.test', password: 'wrong' });
    assert(response.status === 401, `Expected 401, got ${response.status}`, response.data);
  }, 'P1');

  await test('Doctor login and core APIs work', async () => {
    const login = await doctor.post('/api/auth/staff/login', { role: 'DOCTOR', email: 'chloe.chen@aura.test', password: 'chloe@123' });
    assert(login.status === 200, `Expected doctor login 200, got ${login.status}`, login.data);
    for (const path of ['/api/doctor/dashboard', `/api/doctor/schedule?date=${todayYmd()}&month=${monthKey()}`, '/api/doctor/patients/lists']) {
      const response = await doctor.get(path);
      assert(response.status === 200, `${path} returned ${response.status}`, response.data);
    }
  }, 'P1');

  await test('Doctor can load appointment detail, save notes, save prescription, and complete appointment', async () => {
    const context = await doctor.get(`/api/doctor/appointment-context?appointmentId=${appointmentId}`);
    assert(context.status === 200, `Expected appointment context 200, got ${context.status}`, context.data);
    const notes = await doctor.patch(`/api/doctor/appointments/${appointmentId}/notes`, {
      observations: `QA observations ${stamp}`,
      recommendedActions: ['QA blood panel', 'QA follow-up'],
      status: 'IN_PROGRESS',
    });
    assert(notes.status === 200, `Expected notes 200, got ${notes.status}`, notes.data);
    const prescription = await doctor.post('/api/doctor/prescriptions', {
      appointmentId,
      medications: [{ name: 'QA Medicine', dosage: '1 tab', frequency: 'Once daily', duration: '3 days', instructions: 'After food' }],
      advice: 'QA advice',
      followUpDate: todayYmd(10),
    });
    assert(prescription.status === 201, `Expected prescription 201, got ${prescription.status}`, prescription.data);
    const completed = await doctor.patch(`/api/doctor/appointments/${appointmentId}/notes`, {
      observations: `QA completed observations ${stamp}`,
      recommendedActions: ['QA completed follow-up'],
      status: 'COMPLETED',
    });
    assert(completed.status === 200, `Expected complete 200, got ${completed.status}`, completed.data);
    assert(completed.data.appointment?.status === 'COMPLETED', 'Appointment did not become COMPLETED', completed.data);
  }, 'P1');

  await test('Doctor handwritten prescription upload validates file type', async () => {
    const form = new FormData();
    form.append('name', 'QA bad prescription');
    form.append('file', new Blob(['not an image'], { type: 'text/plain' }), 'bad.txt');
    const response = await doctor.post(`/api/doctor/appointments/${appointmentId}/prescription-photo`, form);
    assert(response.status === 400, `Expected invalid photo 400, got ${response.status}`, response.data);
  }, 'P2');

  await test('Patient and doctor can coexist in one browser session', async () => {
    const otpResponse = await combined.post('/api/auth/patient/request-otp', { phone: qaPatient.mobile });
    const verify = await combined.post('/api/auth/patient/verify-otp', { phone: qaPatient.mobile, otp: otpResponse.data.otp });
    assert(verify.status === 200, `Expected patient verify 200, got ${verify.status}`, verify.data);
    const staffLogin = await combined.post('/api/auth/staff/login', { role: 'DOCTOR', email: 'chloe.chen@aura.test', password: 'chloe@123' });
    assert(staffLogin.status === 200, `Expected doctor login 200, got ${staffLogin.status}`, staffLogin.data);
    const patientMe = await combined.get('/api/auth/me?role=PATIENT');
    const doctorMe = await combined.get('/api/auth/me?role=DOCTOR');
    assert(patientMe.status === 200, `Patient session lost after doctor login (${patientMe.status})`, patientMe.data);
    assert(doctorMe.status === 200, `Doctor session missing (${doctorMe.status})`, doctorMe.data);
  }, 'P1');

  await test('Admin login works with seeded credentials', async () => {
    const login = await admin.post('/api/auth/staff/login', { role: 'ADMIN', email: 'admin@aura.test', password: 'admin123' });
    assert(login.status === 200, `Expected admin login 200, got ${login.status}`, login.data);
    const dashboard = await admin.get('/api/admin/dashboard');
    assert(dashboard.status === 200, `Expected admin dashboard 200, got ${dashboard.status}`, dashboard.data);
  }, 'P2');

  await runBrowserChecks(qaPatient.mobile, appointmentId);

  console.log(JSON.stringify({ baseUrl, results, defects, observations }, null, 2));
  if (defects.some((item) => item.severity === 'P1')) process.exitCode = 1;
}

async function runBrowserChecks(registeredMobile, appointmentId) {
  const chromePath = process.env.QA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const launchOptions = { headless: true };
  if (chromePath) launchOptions.executablePath = chromePath;
  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    defects.push({
      severity: 'P2',
      name: 'Browser automation could not start',
      message: error.message,
      details: { chromePath },
    });
    results.push({ name: 'Browser automation setup', status: 'FAIL', ms: 0, message: error.message });
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await test('UI patient OTP boxes auto-advance and login redirects dashboard', async () => {
    await page.goto(`${baseUrl}/patient/login.html`, { waitUntil: 'networkidle' });
    await page.locator('#login-phase input[type="tel"]').fill(registeredMobile);
    const otpResponsePromise = page.waitForResponse((response) => response.url().includes('/api/auth/patient/request-otp') && response.request().method() === 'POST');
    await page.locator('#login-phase button').first().click();
    const otpResponse = await otpResponsePromise;
    const otpData = await otpResponse.json();
    const inputs = page.locator('#otp-phase input[maxlength="1"]');
    await inputs.first().waitFor({ timeout: 5000 });
    for (let index = 0; index < otpData.otp.length; index += 1) {
      await inputs.nth(index).fill(otpData.otp[index]);
      if (index < otpData.otp.length - 1) {
        const activeIndex = await inputs.evaluateAll((nodes) => nodes.findIndex((node) => node === document.activeElement));
        assert(activeIndex === index + 1, `OTP did not auto-advance from box ${index + 1} to ${index + 2}; active index ${activeIndex + 1}`);
      }
    }
    await Promise.all([
      page.waitForURL('**/patient/dashboard.html', { timeout: 10000 }),
      page.locator('#otp-phase button').first().click(),
    ]);
  }, 'P1');

  await test('UI doctor login, schedule View opens appointment details', async () => {
    await page.goto(`${baseUrl}/staff/login.html`, { waitUntil: 'networkidle' });
    await page.locator('#staff-email').fill('chloe.chen@aura.test');
    await page.locator('#staff-password').fill('chloe@123');
    await Promise.all([
      page.waitForURL('**/doctor/dashboard.html', { timeout: 10000 }),
      page.locator('#staff-login-form button[type="submit"]').click(),
    ]);
    await page.goto(`${baseUrl}/doctor/schedule.html`, { waitUntil: 'networkidle' });
    await page.locator('[data-appointment-tab="future"]').click();
    const detailUrl = `/doctor/appointment-details.html?appointmentId=${appointmentId}`;
    const link = page.locator(`a[href="${detailUrl}"]`).first();
    await link.waitFor({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(`**${detailUrl}`, { timeout: 10000 }),
      link.click(),
    ]);
    await page.locator('#appointment-patient-name').waitFor({ timeout: 10000 });
  }, 'P1');

  await test('UI protected doctor page uses common sidebar and no visible DB error', async () => {
    await page.goto(`${baseUrl}/doctor/dashboard.html`, { waitUntil: 'networkidle' });
    await page.locator('.aura-sidebar').waitFor({ timeout: 5000 });
    const text = await page.locator('body').innerText();
    assert(!/Database not connected|record not found in database/i.test(text), 'Doctor dashboard shows database error text');
    assert(await page.locator('.aura-sidebar a:has-text("Dashboard")').count(), 'Dashboard sidebar item missing');
    assert(await page.locator('.aura-sidebar a:has-text("Appointments")').count(), 'Appointments sidebar item missing');
    assert(await page.locator('.aura-sidebar a:has-text("Patients")').count(), 'Patients sidebar item missing');
  }, 'P2');

  if (consoleErrors.length) {
    observations.push({ name: 'Browser console warnings/errors', details: consoleErrors.slice(0, 25) });
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
