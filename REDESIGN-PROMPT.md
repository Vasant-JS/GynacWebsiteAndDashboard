# Copy-ready redesign prompt

Redesign Sumohan Care into a polished, welcoming and professional healthcare website and portal experience. Create a fresh visual design with clearer hierarchy, balanced spacing, restrained colors, readable typography and consistent components. Preserve the content and working functionality described below. The current layout is not the visual reference to follow.

## 1. Brand and verified hospital information

- Public brand: Sumohan Care.
- Parent hospital: Sumohan Medico Surgical Centre and Maternity Home.
- Parent website: https://sumohanhospital.com/
- Hospital founded in 1984, serving Shivamogga for more than four decades.
- Address: Achyutha Rao Layout, 3rd Cross, ANK Road, Shivamogga - 577201.
- Email: sumohanhospital@gmail.com.
- Phone numbers: +91 86188 18012; +91 94816 05619; +91 98860 22725; +91 63619 90860.
- Contact source: https://sumohanhospital.com/contact-us/
- Hospital background source: https://sumohanhospital.com/about-us/
- Facilities described by the parent hospital: 22 beds, labour theatre, operation theatre, inpatient/outpatient care, day care, NICU, laboratory and pharmacy.
- Parent hospital disciplines: obstetrics and gynecology, pediatrics, general surgery/specialty, general medicine/specialty and anesthesiology. Distinguish these from the twelve consultation categories offered by this platform.
- Retain the footer developer credit, currently written as “Developed by Ekathva Innvoations”, linking to http://ekathvainnovations.com/.

Use the supplied family-heart logo. Its colors include pink, cyan/blue and purple. Current site accent colors are #b0004a, #006a62 and #000767; these are references, not a requirement to reproduce the current palette. Prefer a clean light foundation and restrained brand accents.

Existing image assets:

- Logo: D:/Projects/Gynecologist Consultation Website/assets/images/sumohan-care-logo.png
- Dr Abhay M Patel: D:/Projects/Gynecologist Consultation Website/assets/images/doctors/abhay-m-patel.jpeg
- Dr Hemamohan: D:/Projects/Gynecologist Consultation Website/assets/images/doctors/hemamohan.jpeg
- Dr Sahana Hegde: D:/Projects/Gynecologist Consultation Website/assets/images/doctors/sahana-hegde.jpeg

Use the supplied photographs for these doctors. Keep their proportions and use thoughtful cropping. Do not substitute stock doctor portraits for their identities.

## 2. Public website structure and navigation

The public website must remain ONE PAGE with smooth section navigation. Its sections are:

1. Hero/introduction.
2. About the hospital/platform, vision, mission and care approach.
3. Consultation process.
4. Doctors, with search and filters.
5. All twelve services.
6. Optional testimonials.
7. Consultation planning form.
8. FAQs.
9. Contact information and enquiry form.
10. Footer.

Important exceptions and interactions:

- Clicking a doctor card opens a modal with doctor details and availability. Do not create a separate visible doctor-details section or navigate to a new profile page.
- Patient Privacy & Consent belongs on its OWN PAGE, currently /website/privacy.html. Footer privacy and consent links should open that page.
- Patient and staff logins and authenticated portals remain separate account flows.
- About, Doctors, Services, Testimonials, FAQs and Contact navigation should scroll to their homepage sections.
- Hero booking buttons scroll to the consultation-planning section.
- Service cards scroll to the planning section and preselect the chosen service.
- The modal's planning button closes the modal, scrolls to planning, and preselects that doctor.
- Only the explicit “Continue to Patient Portal” action moves into the patient account/login flow.
- Preserve compatibility with existing public URLs, which redirect to the matching homepage section or doctor modal.

The existing headline is “Compassionate Care for Every Stage of Womanhood”. You may improve the wording and presentation while keeping the hospital identity and gynecological focus clear. The platform also offers male infertility consultation, so do not imply that every consultation category excludes men.

## 3. About and consultation-process content

Sumohan Care supports booking, patient records and follow-up care for its parent hospital in Shivamogga. The hospital began in 1984, with maternity and child health central to its work.

- Vision: familiar, compassionate healthcare and a continuing commitment to healing, building on the hospital's founding vision.
- Mission: improve patients' health and well-being through responsible care, clinical expertise and high standards of medical practice.
- Healthcare approach: specialist care supported by the hospital's inpatient/outpatient services and clinical facilities.
- Patient care: prepare a profile, choose a consultation, share reports and keep records available for follow-up; the treating doctor maintains the clinical case sheet.
- Process: Register → Choose Doctor → Select Slot → Confirm Booking → Consultation.

## 4. Exact current doctor roster

Use only these three current doctors:

1. Dr Abhay M Patel
   - Qualifications: MBBS MS(OBG)
   - Specialization: Obstetrics and Gynecology
2. Dr Hemamohan
   - Qualifications: MBBS MD(OBG). Laparoscopic Surgeon. MBA(Hospital Admin)
   - Specialization: Obstetrics and Gynecology
   - Additional title: Laparoscopic Surgeon
3. Dr Sahana Hegde
   - Qualifications: MBBS MD(OBG)
   - Specialization: Obstetrics and Gynecology

Fees, years of experience and languages are not currently configured for these doctors. Do not invent them. Display configured values when available; otherwise omit unknown experience/languages and use “Contact the hospital for details” for the fee.

Doctor search matches name, qualifications and specialization. Available filters include specialization and configured Kannada/English/Hindi languages.

Doctor modal requirements:

- Correct photo, name, qualifications, specialization, configured experience/languages and fee information.
- Date picker and actual available consultation slots, shown in India Standard Time.
- Loading, unavailable-date and error states.
- Planning CTA that selects the current doctor.
- Responsive scrolling within the modal, visible close control, Escape/outside-click closing, keyboard focus management and background scroll locking.

## 5. All twelve consultation services

Display FOUR service cards per row on desktop, two on tablet and one on mobile. Use the following categories in this order and retain them in the booking dropdown:

1. Obstetrics (pregnancy): pregnancy care, antenatal visits and questions during pregnancy.
2. Gynecology: gynecological concerns and ongoing reproductive health.
3. Male infertility consultation: male fertility concerns, previous investigations and next steps.
4. Female infertility consultation: female fertility concerns, relevant reports and further evaluation.
5. General check-up: routine health consultation and a review of current concerns.
6. Postnatal consultation: recovery and health concerns after childbirth.
7. Family planning / Contraception: family planning and contraception options.
8. Menopause: menopause symptoms and related health concerns.
9. Menstrual problems: cycle changes, painful periods, heavy bleeding or missed periods.
10. Discharge PV: vaginal discharge and associated symptoms.
11. PMOS/PCOS: PMOS/PCOS concerns, cycle history and relevant investigations.
12. Other Concerns: other concerns requiring the appropriate consultation.

Use simple, consistent icons and clear descriptions. Keep cards balanced and avoid treatment guarantees.

## 6. Consultation planning, registration and patient portal

Homepage planning fields: New/Follow-Up consultation type, consultation category and preferred doctor. Continue to the patient portal with these choices preserved.

Registration fields:

- Automatically generated unique Case ID and registration date.
- Full name; age as per Aadhaar; gender.
- Mobile number; WhatsApp number; email.
- City and country.
- Optional medical history, allergies, diabetes, blood-pressure condition and other conditions.

Current mobile/WhatsApp login validation accepts Indian ten-digit numbers. Registration displays the Case ID. Do not add Aadhaar identity verification; the requirement only specifies how age is described.

Patient login uses mobile-number OTP. Existing local-development OTP behavior must remain usable. Do not place passwords or test credentials in public UI or source copy.

Booking flow:

- New Consultation: “No previous consultation” selected; previous visit is not required.
- Follow-Up Consultation: require a previous consultation belonging to the signed-in patient, and preserve its link with the new booking.
- Switching back to New clears the previous consultation selection.
- Select category, enter consultation reason, choose doctor, select a future available date/time.
- Allow optional PDF/JPG/PNG reports up to 10 MB, with title, report date and category: Scan report, Blood investigation or Other.
- Associate booking-time uploads with the confirmed consultation.
- Require medical-information consent and an accuracy declaration.
- Record the matching patient name, declaration date/time and policy version.
- Prevent already-booked/unavailable slots and show clear confirmation/error states.

Patient portal features: dashboard, upcoming/past appointments, cancellation/rescheduling, appointment feedback, new/follow-up booking, profile editing, uploaded reports and prescriptions. Existing historical records must be preserved.

## 7. Doctor portal and clinical case history — priority module

Provide a coherent, efficient clinical workspace with dashboard statistics, today's/upcoming appointments, schedule, patient search, current/future/past consultation lists, availability and slot management.

Open case history from a consultation or assigned-patient search. Display patient name, full Case ID, age/gender, contact details, blood type, consultation reason, prior visits, reports and prescriptions.

The structured clinical case sheet must retain ALL seven groups:

1. Chief complaints:
   Main complaints; duration; associated symptoms; previous consultations and treatments.

2. Obstetric history:
   Pregnancy status Yes/No/Unsure; first day of LMP; cycle length; assessment date; estimated EDD; POG in weeks/days; G/P/A/L; previous delivery PTVD/FTVD/Caesarean/no previous pregnancy; Caesarean indication; repeatable children rows with gender, age and notes; previous/current pregnancy complications; USG and antenatal-record availability; blood group; Rh factor; Anti-D administered; ICT performed and result; high-risk status.
   Show Anti-D/ICT fields conditionally for Rh-negative patients, and the ICT result only when the test was performed.

3. Menstrual history:
   Regular/Irregular/Missed cycle; cycle length; bleeding duration; painful periods, HMB, irregular cycles, PMOS/PCOS, discharge PV and itching selections; other complaints; marital status; contraception details; prior infertility investigations/workup.

4. Medical history:
   Type 1/Type 2 diabetes, hypertension, thyroid disorders, bronchial asthma and coronary artery disease; other conditions; past transfusions; previous surgeries; drug allergies/details.

5. Family history:
   Family-history text.

6. Physical measurements:
   Height in cm; weight in kg; calculated BMI; waist and hip circumference in cm.

7. Diagnosis and treatment plan:
   Provisional diagnosis; treatment plan; investigations advised; follow-up required and suggested date; referral required and referral details.

Calculation behavior already implemented:

- Estimated EDD: LMP + 280 days, adjusted by cycle length minus 28 days.
- POG: elapsed calendar days between LMP and assessment date, expressed as completed weeks and remaining days.
- BMI: weight in kg / height in metres squared.
- Validate dates and measurements; label estimates clearly and retain the clinical dating explanation/NHS reference.
- Unknown answers remain unrecorded; do not default them to “No”.

Preserve database-backed per-consultation saves, consultation timeline, saved revision history, concurrent-edit conflict detection, unsaved-change protection, authorized access and print/save-as-PDF output that includes long notes without clipping. Make the lengthy form easy to navigate using sensible grouping and progressive disclosure.

Prescription features: medication name, dosage, frequency, duration and instructions; general advice; follow-up date; draft/final saving; viewing previous prescriptions; handwritten prescription photo upload in JPEG/PNG/WebP up to 8 MB.

## 8. Administrator features

Maintain admin overview, doctor management, patient records, existing revenue/settings views and contact enquiries.

- Manage doctor status and confirmed professional details.
- Set doctor login email/password, qualifications, experience and languages.
- Contact enquiry inbox with NEW, IN_PROGRESS and CLOSED states.
- Preserve existing role-based access and stored data.

## 9. Contact, FAQs and privacy

Contact section: show the exact hospital address, all four phone numbers, email, parent-hospital link and a Get Directions map link. Make phone/email controls usable on mobile.

Enquiry form: name, email, subject and message. It currently saves to the hospital's admin inbox; it does not automatically send email. Provide confirmation/reference, loading and error states.

FAQs should explain:

- How to register and book.
- How to link a follow-up to an earlier visit.
- Supported report uploads and size limit.
- How to confirm consultation arrangements with the hospital.
- Payment arrangements while integration is deferred.
- Appointment cancellation/rescheduling.
- Login/upload troubleshooting and contact support.

Separate Patient Privacy & Consent page: information collected for care, medical-information use, declaration requirements, recorded name/date/policy version, access/corrections, saved clinical revisions and external-service status. Retain related consent, service-use and patient-information links and a route back to the main website.

## 10. Existing placeholder content and deferred features

The current homepage has unverified testimonial placeholders attributed to Jessica Thompson, Nisha Rao, Aditi Mehra and Maria Fernandes, describing prenatal care, clear explanations, fertility planning and pregnancy support. It also contains “Trusted by 5,000+ Women” and “Rated 4.9/5” placeholder claims. Omit or clearly treat these as placeholders until genuine testimonials and figures are supplied. Do not present them as verified evidence or reuse sample patient portraits as real patients.

Live payments, external OTP/message delivery, WhatsApp/SMS/email notifications, Google Meet/video/audio integration and doctor transaction reporting are DEFERRED. Do not build these integrations during this redesign or imply that they are active. Current booking confirms appointments without collecting online payment. Internal appointment updates can still appear in dashboards.

## 11. Design and implementation expectations

- Use a calm, contemporary healthcare visual system with consistent typography, spacing, controls and icons.
- Keep the hierarchy clear and the hero proportionate. Avoid excessive empty space, heavy decoration and inconsistent card sizes.
- Ensure readable contrast, visible focus states, keyboard access, accessible labels and sensible validation messages.
- Preserve four-across desktop services and a responsive mobile layout with no horizontal overflow.
- Keep doctor information inside its modal, privacy on its separate page, and public navigation within the homepage.
- Use actual available content, photos and configured doctor data. Do not invent fees, languages, experience, ratings, guarantees or 24/7 availability.
- Apply a coherent design system across public pages and patient/doctor/admin portals; prioritize the clinical case-history experience.
- If implementing in the current repository, retain the existing Express/PostgreSQL backend, APIs, sessions, role permissions and data. Redesign the frontend without resetting the database or replacing working flows with mockups.
- Check desktop/mobile navigation, doctor modal, service/doctor selection, registration, new/follow-up booking, uploads/declarations, case-sheet saving/reloading and contact enquiries.

Deliver a complete, usable redesign with all required content and interactions, not only a static landing-page mockup.
