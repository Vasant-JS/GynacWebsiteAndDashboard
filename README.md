# Sumohan Care Gynecologist Consultation Website

Recreated project structure:

- `website/` public website pages
- `patient/` patient login, dashboard, booking, appointments, reports, profile
- `doctor/` doctor dashboard, schedule, patient registry, appointment details, prescription
- `admin/` admin dashboard, doctor management, patient records, revenue, settings, WhatsApp placeholder
- `server/` Express route modules
- `scripts/setup-db.js` PostgreSQL schema and seed data
- `assets/js/` page scripts
- `uploads/` uploaded medical documents

## Setup

Install dependencies:

```powershell
npm install
```

Start PostgreSQL, then prepare the database:

```powershell
npm run db:setup
```

Start the app:

```powershell
npm run dev
```

Open:

- `http://localhost:5177`
- Patient login: `http://localhost:5177/patient/login.html`
- Doctor/Admin login: `http://localhost:5177/staff/login.html`

Development admin login:

- Admin: `admin@aura.test` / `admin123`

Patient OTP is generated and shown on screen in development.

## Case history and current implementation

Razorpay checkout, capture verification, signed webhooks and payment reconciliation are prepared behind `PAYMENT_PROVIDER=razorpay`. Existing demo mode remains the default; real collection requires private API/webhook keys and explicit configuration. See `RAZORPAY-SETUP.md` for setup, provider testing, fee configuration and paid-slot-conflict handling. The app does not require a Razorpay login password.

Homepage contact submissions now use the enquiry API and show a saved reference only after success. Administrators can review them under Contact Enquiries (including mobile navigation), refresh the inbox, and update enquiry status. Doctors can edit experience and languages from Doctor Profile; the homepage loads those values from the database. The active booking confirmation transaction now creates internal patient and assigned-doctor notifications. SMS OTP and outbound booking-message integration are deferred until provider details are supplied.

Booking uploads are attached to the confirmed appointment in both confirmation flows, and confirmation waits for an in-progress upload. Google Calendar stores the event/calendar IDs with the appointment, polls pending conferences and refreshes pending links on join. Patient reschedules and patient/doctor cancellations synchronize with Calendar; failed synchronization leaves the booking unchanged and reports an error. Join routes check the signed-in patient/doctor and reject completed/cancelled appointments. Homepage support FAQs cover login/OTP, file uploads and Meet connectivity. Verify the provider adapter and database workflows with `node --test scripts/test-meeting.js scripts/test-clinical.js`. A live integration check on November 6 created, rescheduled and cancelled temporary events without attendees, and a Meet link reached the admission screen; an actual two-party call was not tested.

Doctor Payments & Transactions is available at `/doctor/payments.html`. Records are scoped through the appointment's assigned doctor, with appointment date/status filters, currency totals, demo labels, and unpaid bookings. This is reporting over saved records; a live payment gateway is still pending. Verify access isolation and reporting with `node --test scripts/test-doctor-payments.js`.

The retained progress checklist is `PROJECT-ALIGNMENT-AUDIT.md`.

Doctors can open a consultation from Patients (including Past Consultations) or patient search to create a structured clinical case sheet. Seven clinical groups include obstetric and menstrual history, child records, measurements, diagnosis and treatment. EDD/gestation and BMI are calculated from entered data. Saves retain revisions and reject stale edits from another session. Print opens a text-based case-sheet view so long notes are not clipped by form controls.

The case-history and enquiry tables are prepared automatically at application startup and by database setup. Existing consultation records are preserved. Run the database-backed checks with `node --test scripts/test-clinical.js` (or `npm run test:clinical`); test records are cleaned up afterward.

The current three doctors are defined in `assets/doctors.json`. Run `node scripts/update-doctor-roster.js` to synchronize the roster without deleting prior appointment history. An administrator can set each doctor's login email/password and confirmed professional details from Manage Doctors. New roster entries do not have invented login credentials.

Registration includes gender, WhatsApp, city/country and a displayed Case ID. Booking supports all twelve consultation categories, linked follow-up visits, report uploads and saved declarations. About, Contact/FAQs, a doctor details/availability modal, consultation planning are sections on the single-page public homepage. Patient Privacy & Consent is a separate page at `/website/privacy.html`. Legacy URLs under `website/` redirect to those sections. Contact enquiries are saved to the admin inbox. Hospital contact data and its verified source are recorded in `assets/hospital.json`.

The booking flow can create a Google Calendar event with a Google Meet link when OAuth credentials are configured in `.env` (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN`). The event uses the selected appointment time, its configured duration, and `APPOINTMENT_TIME_ZONE` (default `Asia/Kolkata`), then stores the Meet URL and Calendar event ID in appointment metadata. Without credentials, booking still works and the meeting is marked `not_configured`. Email delivery is not connected yet; share the sender/provider details to add confirmation emails.

### Google Calendar OAuth setup

The backend must be authorized as `sumohancaretech@gmail.com` to create events on that account's primary calendar. Keep all OAuth credentials private and store them only in the ignored local `.env` file.

1. In Google Cloud Console, select the `SumohanCare` project, enable the Google Calendar API, and configure Google Auth Platform branding/audience. If the app is External and in Testing, add `sumohancaretech@gmail.com` under Audience > Test users.
2. Create an OAuth client with application type **Web application** and add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
3. Open Google OAuth 2.0 Playground. In settings, select **Use your own OAuth credentials**, choose **Server-side** and **Offline**, and enter the OAuth client ID and secret from the downloaded client JSON.
4. In Step 1, request `https://www.googleapis.com/auth/calendar.events`, authorize while signed in as `sumohancaretech@gmail.com`, and continue past the unverified-app warning for this project. In Step 2, exchange the authorization code for tokens and copy the refresh token privately.
5. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN` in `.env`. `GOOGLE_CALENDAR_ID=primary` targets the authorized account's primary calendar. Restart `npm run dev` after changing `.env`.

Do not commit, upload, or send the client JSON, client secret, authorization code, or refresh token. With an External app in Testing, Google refresh tokens for Calendar access expire after 7 days; this is fine for a short local test, but production needs the consent screen publishing setup completed. The configured `BOOKING_NOTIFICATION_EMAIL` records the notification recipient; outbound email delivery is a separate integration.

The current booking flow confirms appointments without collecting online payment. Existing development OTP behavior remains available for local testing.
