# Sumohan Care project alignment audit

## November 6 2026 payment reporting update

Razorpay preparation is implemented behind a configuration gate: server orders, Checkout integration, signature/captured-payment verification, signed webhooks, duplicate protection, booking snapshot recovery and reconciliation flags. Admins can set confirmed doctor fees; gateway statuses cannot be changed through demo/manual payment endpoints. Local simulated tests pass. Real provider Checkout/webhook testing and production activation remain pending credentials. See `RAZORPAY-SETUP.md`.

Homepage enquiries now persist before success is displayed and are available under the separate admin Contact Enquiries tab with refresh/status management. Browser verification submitted a synthetic enquiry, viewed it in the authenticated admin inbox and updated its status; the test record was removed. Doctor Profile now supports editing experience/languages with server validation and doctor ownership, and homepage cards read these values from the public API. The active booking path now inserts assigned-doctor and patient notifications atomically. Database checks cover profile persistence/ownership and booking notification recipients. SMS OTP and outbound booking confirmations are deferred pending messaging provider details.

Report attachment is verified for both booking confirmation paths, including preserving documents on earlier consultations. Booking waits for an active upload before confirming. Technical FAQs now cover OTP/login, uploads, and Meet connectivity, and public consultation wording describes Google Meet video/audio. Calendar rescheduling and cancellation are connected to patient/doctor actions, with failures leaving the booking unchanged. Join redirects check appointment ownership and closed status. Automated provider/database tests pass; temporary live Calendar events were created, rescheduled and cancelled without attendees, and a generated Meet URL reached the Ready to join admission screen. Host admission and a two-party call still require a manual check.

Homepage doctor availability now queries the public doctor roster and date-specific database availability instead of showing static sample slots. Both booking confirmation paths now validate and persist declarations (including server timestamp), consultation type and prior consultation/hospital case reference. The active demo-payment path also associates booking uploads with the new appointment. Database checks cover blocked dates/custom times, booked-slot exclusion, consent rejection and persistence, follow-up ownership/linkage and new consultations without stale links. The payment gateway remains a demo.

Doctor Payments & Transactions is now implemented at `/doctor/payments.html`, with desktop/mobile navigation, appointment date and payment status filters, pagination, transaction details and per-currency totals. The API restricts records to appointments assigned to the authenticated doctor. Bookings without payment records show Not collected, and existing demo transactions are labelled. Database tests verify doctor isolation, role access, date boundaries, status filtering and separate currencies. Live payment collection remains pending. The historical audit below describes the earlier implementation.

Reviewed October 14, 2026 against all six pages of `Sumohan Care – Project Overview.pdf`.

Scope: source inspection of current public pages, patient and doctor portals, frontend scripts, Express APIs, and database schema. This is a requirements comparison, not a completed live database or third-party integration test. The PDF is treated as a reference specification, not as instructions to change the application. No application changes were made for this audit.

Status meanings:

- **Present / aligned:** UI and corresponding implementation exist for the described core capability; live operation remains to be verified.
- **Partial / different:** some capability exists, but required fields, workflow, page structure, or integrations differ.
- **Missing:** no implementation found for the specified capability.
- **Placeholder:** a visible or coded feature simulates the required external service.

## Current implementation progress - October 14, 2026

Public website layout update: public information lives on the homepage with section navigation; Patient Privacy & Consent has its own page as requested. Legacy About, Doctors, Contact and doctor-profile URLs redirect to the matching homepage section. Patient/staff account workflows remain separate.

This checklist is retained as the project tracker. The initial audit below remains as the baseline. Payment, messaging and Google Meet work is deferred at the user's request.

| Area | Current status |
| --- | --- |
| Homepage, services, process, testimonials, booking buttons | Retained; hospital contact details updated and doctor roster loaded from database |
| Doctor dashboard, schedules, patient search | Retained; patient search now links to case history and is restricted to assigned patients |
| Doctor availability and slot blocking | Retained; public profile availability and booking slot checks use database records |
| Patient reports and prescriptions | Retained; reports can also be uploaded during booking and linked to the new appointment |
| About Us | Implemented homepage section with hospital heritage, vision, mission, approach and patient care |
| Doctors page | Implemented inline live roster, name/qualification/specialty/language filters, doctor details and available slots in a modal opened from each doctor card; admin can supply confirmed languages and experience |
| Registration | Implemented gender, WhatsApp, city/country, age-as-per-Aadhaar wording, automatic registration date and displayed patient Case ID |
| Consultation categories | Implemented all twelve categories in a dropdown |
| Follow-up consultation | Implemented dedicated type selection, previous-visit selection, ownership validation and stored previous-appointment link; visible entry point on Appointments |
| Booking-time report upload | Implemented PDF/JPG/PNG form, scan/blood report categories, upload persistence and appointment association |
| Patient consent/declaration | Implemented both acknowledgments, matching patient name, server-side validation, recorded date/time and policy version |
| Detailed clinical case sheet | Implemented all seven clinical groups, child records, conditional Rh/Anti-D/ICT fields, estimated EDD/POG and BMI, persistent per-visit records, consultation timeline, saved revisions, edit conflict detection and printing |
| Payments, notifications, video/audio calls | Live external integrations deferred; booking records that no online payment was collected. Internal appointment updates are saved for the patient/doctor dashboard |
| Doctor transaction reporting | Deferred with payment work |
| Contact page/form and FAQs | Implemented homepage sections with verified parent-hospital details, map link, persisted enquiry form, admin enquiry inbox/status management and booking/consultation/payment/support FAQs |

Case history access: Doctor portal > Patients > current/future/past consultation > Open Patient Info, or patient search > Open Case History. Each case sheet is linked to its consultation and patient. Case ID uses the full generated patient UUID to avoid truncation collisions.

Doctor account setup: Admin > Manage Doctors > Doctor Accounts & Profile Details. The newly supplied doctors have no invented login credentials; an administrator can assign a login email/password and verified professional details.

Parent source: https://sumohanhospital.com/contact-us/ and https://sumohanhospital.com/about-us/. Details verified October 14, 2026: Achyutha Rao Layout, 3rd Cross, ANK Road, Shivamogga - 577201; sumohanhospital@gmail.com; +91 86188 18012, +91 94816 05619, +91 98860 22725 and +91 63619 90860.

Calculation assumptions: EDD uses LMP + 280 days, adjusted by entered cycle length minus 28 days; gestation uses calendar days between LMP and assessment date; BMI uses kg / metres squared. LMP dates and measurements are validated, estimates are labeled, and the application links to NHS guidance. Unknown clinical answers stay unrecorded rather than defaulting to No.

Verification: database-backed tests cover calculations, invalid data, saving/reloading revisions, stale edits, unauthorized access, assigned-patient search, linked follow-up booking, required declarations, booking-time report association, duplicate slot rejection, registration, admin doctor-account updates and enquiry management. Browser checks cover public pages, live specialty filtering/availability, desktop/mobile case-sheet editing and persistence, registration and booking, linked report persistence, SPA follow-up navigation and mobile booking layout. Test patient/doctor/enquiry records are removed after verification.

Remaining setup: assign doctor login details and confirmed language/experience data; payment, messaging, video/audio and transaction integrations remain deferred. Registration currently accepts Indian ten-digit mobile/WhatsApp numbers, matching the existing login system.

---

## Initial audit baseline

## Customer features

| PDF requirement | Status | Current implementation and gap |
| --- | --- | --- |
| Homepage introduction, platform information, process, services, features, benefits, testimonials, contact and calls to action | Mostly aligned | `index.html` provides an introduction, about section, five-step process, doctors, services, testimonials and booking/login buttons. Contact details are sample values; service coverage is narrower than the PDF categories. |
| About Us page: clinic/platform, vision and mission, healthcare approach, patient care | Partial / different | Homepage has an About section and care description. No separate About page or explicit vision/mission content found. |
| Doctors listing and profile details | Partial | `website/doctors.html` displays static names, photos, specialization, experience, fee, language and next-availability labels. Qualification details and a working public profile detail flow are missing. View Profile and Book Now buttons have no matching handlers in the loaded script. |
| Kannada, English, Hindi availability | Partial | Listing includes these filter labels and some language text. Filters are not connected to doctor data; not all sample doctors list the specified languages. |
| Doctor consultation timings | Partial | Public listing has static availability labels. Actual booking queries doctor availability from PostgreSQL; the public listing is not synchronized with it. |
| New Consultation versus Follow-Up Consultation selection | Missing | Booking selects service/reason, doctor and slot; no distinct consultation-type selection or stored linkage to a previous consultation was found. |
| Registration: automatic unique Case ID and registration date | Partial | Database automatically generates a UUID and creation timestamp; registration stores `registeredAt`. No dedicated patient-facing Case ID presentation at registration. Prescription UI uses a shortened patient UUID. |
| Registration: name and age as per Aadhaar | Partial | Name and numeric age are required. No wording identifying age as per Aadhaar. The PDF does not require Aadhaar identity verification. |
| Registration: gender | Missing at registration | Gender is editable later in the patient profile but is not collected during registration. |
| Registration: WhatsApp number | Partial | Registration collects mobile number; login can store WhatsApp number with mobile fallback. No explicit WhatsApp field on registration. |
| Registration: city / country | Missing at registration | Patient profile supports a later free-text permanent address; registration has no city/country fields. |
| All twelve consultation categories in a dropdown | Different / incomplete | UI has six cards: Pregnancy, PCOD/PCOS, Menstrual issues, Fertility, General Gynecology, Something Else. It is not the specified twelve-option dropdown. |
| Doctor selection and date/time booking | Present / aligned | `patient/book-slot.html`, `assets/js/book-slot.js` and `server/patient.js` load doctors, availability and booked slots, select a future slot, and persist an appointment through the demo-payment flow. |
| Report upload during booking: PDF, JPG, PNG; scan/blood reports | Partial | PDF/JPEG/PNG uploads exist in the separate patient reports flow. The booking script listens for `booking-document-upload-form`, but that form is absent from `patient/book-slot.html`. Scan/blood investigation categorization is not implemented as the specified booking flow. |
| Online payment: UPI, debit/credit card, net banking, wallets | Placeholder | Payment rows and receipts exist, but APIs use `manual_demo` / `manual_placeholder`; a request directly marks a payment paid. No real gateway checkout, settlement verification or listed payment-method integrations found. |
| Booking notification through WhatsApp, SMS or email | Placeholder / missing delivery | WhatsApp sharing opens a prefilled `wa.me` message. No automatic outbound provider integration found. OTP is returned on screen in development. Internal notification storage is not external message delivery. |
| Declaration: medical-information consent and accuracy acknowledgment | Missing | Login has generic privacy/consent wording, but no booking declarations or server-side record of these acknowledgments. |
| Declaration: patient name and declaration date | Missing | No declaration capture or saved name/date record found. |
| Dedicated follow-up page and workflow | Partial components; dedicated flow missing | Returning patients can log in, view existing records and book another appointment. Prescriptions can store a follow-up date. There is no dedicated follow-up booking flow linked to an earlier consultation, with its own type/reason/payment rules. |
| Contact Us page and contact form | Missing page/form | Footer contains contact details, but there is no separate Contact page or form submission API. |
| Contact phone, email and clinic/location | Partial | Homepage footer includes sample phone, `care@aurahealth.example`, and generic clinic location. Real business contact data remains to be supplied. |
| FAQs: booking, consultation, payment, technical support | Missing | No FAQ section covering the four requested areas found. |
| Video/audio consultation | Placeholder | `server/meeting.js` constructs a `meet.google.com/dev-...` URL and labels it `development_placeholder`; it does not create a real meeting. Call/join controls are not evidence of a functioning consultation service. |

### Category mapping

| Required category | Current mapping |
| --- | --- |
| Obstetrics (pregnancy) | Pregnancy card; approximate match |
| Gynecology | General Gynecology card; approximate match |
| Male infertility consultation | Fertility card only; no separate selection |
| Female infertility consultation | Fertility card only; no separate selection |
| General check-up | No explicit category |
| Postnatal consultation | No explicit category |
| Family planning / Contraception | No explicit category |
| Menopause | No explicit category |
| Menstrual problems | Menstrual issues card; approximate match |
| Discharge PV | No explicit category |
| PMOS/PCOS | PCOD/PCOS card; terminology differs |
| Other Concerns | Something Else card; approximate match |

## Doctor features

| PDF requirement | Status | Current implementation and gap |
| --- | --- | --- |
| Dashboard: appointment overview, today's schedule, booked slots, updates, patient records access | Core present | Dashboard and API provide appointment totals/pending/missed/today figures, today's schedule, internal notification list and patient search. Notification delivery and event generation are incomplete. |
| Upcoming appointments, date/time, patient schedule, daily management | Present / aligned | Schedule API/page and current/future patient lists exist; appointment status updates are supported. |
| Patient basics: name, identifier, age, gender, mobile/WhatsApp, consultation reason | Partial | Current appointment context exposes patient UUID/profile/contact and service/notes. Gender depends on later profile completion. No dedicated Case ID system beyond UUID and abbreviated display. |
| Appointment history and previous consultation details | Partial | Patient portal has appointments; doctor appointment context retrieves previous prescriptions and uploaded reports. No comprehensive doctor-facing historical case-sheet timeline was found; doctor patient lists focus on current/future bookings. |
| Medical reports and records | Present / aligned | Doctor context loads uploaded documents and prescriptions; view/download routes and prescription photo upload exist. |
| Create, view, update and maintain detailed case sheets | Largely missing | Doctor can save free-text observations and recommended actions and write prescriptions. Those are not the structured clinical case sheet specified on PDF pages 4-6. |
| Block dates and time slots, change availability and timings | Present / aligned | `doctor/slots.html`, `assets/js/doctor-slots.js`, and doctor availability API provide date availability, selectable slots and editable ranges. |
| Doctor Payments & Transactions page | Missing | Doctor navigation and APIs have no payment history/report page. `admin/revenue.html` and admin payment endpoints provide a different role's reporting. |

### Detailed clinical case-sheet comparison

| Clinical group | Present | Required fields not implemented as structured case-sheet fields |
| --- | --- | --- |
| Chief complaints | Free-text Chief Complaint & Observations | Separate main complaint, duration, associated symptoms, previous consultations/treatments |
| Obstetric history | General patient medical-history text; blood group can be stored in patient profile | Current pregnancy Yes/No/Unsure; LMP; automatic EDD/POG; G/P/A/L; PTVD/FTVD/Caesarean and indication; children gender/age table; past/current complications; USG/antenatal-record flags; Rh/Anti-D/ICT workflow and result; high-risk status |
| Menstrual history | Broad menstrual service card and generic history text | Regular/Irregular/Missed; cycle length; bleeding duration; painful periods/HMB/irregular cycles/PMOS/discharge/itching/other complaint choices; marital status; contraception details; infertility workup |
| Medical history | General history, allergies, diabetes and blood-pressure flags, other-condition text in patient profile | Type 1/Type 2 diabetes distinction; hypertension/thyroid/asthma/CAD/other dropdown; transfusion flag; dedicated surgery and drug-allergy case-sheet fields |
| Family history | No dedicated field | Family-history textbox |
| Physical measurements | No dedicated fields/calculation | Height, weight, automatic BMI, waist, hip |
| Diagnosis and treatment plan | Recommended actions, prescription medicines/advice and optional follow-up date | Provisional diagnosis; distinct treatment plan and investigations fields; follow-up-required flag; referral-required flag and referral details |

## Alignment beyond feature presence

- The overview describes an online consultation platform. Current content also presents a global/boutique physical-clinic experience, and saved bookings use `Sumohan Care Main Clinic`. Online versus in-person and audio versus video are not explicit booking choices.
- Public doctor cards contain fixed sample identities/fees/availability while booking loads database doctors. A visitor's chosen public doctor is not passed into a working public-card booking handler.
- The six broad service cards do not capture the clinically distinct categories in the PDF, especially male/female infertility, postnatal care, contraception and menopause.
- Gender is deferred to profile editing; city/country and declarations are absent from the required registration/booking stage.
- Generic free-text notes and prescriptions cover part of clinical documentation, but cannot substitute for the requested obstetric/menstrual history, calculations, and case-sheet maintenance.
- Patient login depends on a registered email address and Indian ten-digit mobile number. Email is an additional mandatory registration field; the PDF also asks for country, suggesting that international-patient scope needs a decision.
- About and contact are homepage sections rather than the specified separate pages. This is a structural mismatch even where related content exists.
- Admin management, revenue, settings and WhatsApp mockups are additions beyond the listed PDF scope. Their presence does not satisfy doctor transaction reporting or live messaging requirements.

## Recommended completion order

1. Confirm registration fields and Case ID presentation; implement new/follow-up selection, all twelve categories, and saved declarations.
2. Build the structured doctor case sheet, patient-history view, and EDD/POG/BMI calculations.
3. Complete booking-time report uploads and doctor-specific payment/transaction reporting.
4. Replace simulated payment, OTP/notification delivery and consultation meeting links with working provider integrations.
5. Connect public doctor listings/profiles and availability to database records; complete About, Contact, FAQs and real business details.
6. Verify complete new-consultation and follow-up journeys against a configured database and provider test environments.

## Main implementation evidence

- `index.html`: homepage sections, services, public doctor samples and footer contact/legal links.
- `website/doctors.html`: static listing, language/filter controls and profile/booking buttons.
- `patient/register.html`, `server/auth.js`: collected registration fields and development OTP behavior.
- `patient/profile.html`, `assets/js/patient-profile.js`, `server/patient.js`: later gender/address/history editing.
- `patient/book-reason.html`, `assets/js/design-live.js` (`initReason`): active six-card service selection and reason submission. The separate `book-reason.js` is not loaded by this page.
- `patient/book-slot.html`, `assets/js/book-slot.js`, `server/patient.js`: doctor/date/slot/payment flow; missing booking upload form; demo payment marking.
- `patient/reports.html`, `assets/js/patient-simple-page.js`, `server/patient.js`: separate report-upload flow.
- `server/meeting.js`: generated development meeting URL and WhatsApp sharing link.
- `doctor/dashboard.html`, `assets/js/doctor-dashboard.js`, `server/doctor.js`: schedule, statistics, notifications and patient context.
- `doctor/appointment-details.html`, `assets/js/doctor-appointment-details.js`, `server/doctor.js`: notes, recommendations, prescriptions and documents; no structured case sheet.
- `doctor/slots.html`, `assets/js/doctor-slots.js`, `server/doctor.js`: availability and time-slot management.
- `assets/js/aura-sidebar.js`, `server/doctor.js`, `admin/revenue.html`, `server/admin.js`: doctor navigation/API lacks payment reporting; admin revenue exists separately.
- `scripts/setup-db.js`: UUID identifiers, registration timestamps, appointments, medical documents, payments and internal notifications schema.
