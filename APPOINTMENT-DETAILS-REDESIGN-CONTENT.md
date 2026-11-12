# Appointment Details redesign content

This is a content and behaviour reference for the current Sumohan Care doctor appointment-details page. Visible labels, placeholders, choices and messages below retain the source wording. Text in square brackets describes dynamic data, not replacement UI copy. No real patient data is included.

## Copyable redesign brief

Redesign the existing Sumohan Care doctor Appointment Details screen using the complete content inventory below. Preserve the existing text, clinical fields, dropdown options, actions and functionality. Improve visual presentation and responsive layout while retaining the distinction between Case History and New Prescription. Keep the shared doctor navigation and account controls reusable. Use placeholders for patient and doctor data. Do not introduce new medical fields or remove existing ones. Preserve element IDs, field names and data attributes when returning implementation HTML so the existing scripts can be reconnected.

## Page structure

- Browser title: Appointment Details | Sumohan Care
- Shared doctor sidebar and topbar; mobile navigation on small screens.
- Patient summary card.
- Tabs: Case History; New Prescription.
- Main workspace: active tab content beside the Current Session, completion action and Uploaded Reports.
- Case History is the initial tab.

## Shared navigation text

### Sidebar

- Sumohan Care
- Shivamogga · Est. 1984
- Clinical Ops Active
- 24/7 OT
- Dashboard
- Patient Registry
- Appointments / Schedule
- Clinical Case Sheets
- Prescriptions & Pharmacy
- Payments & Transactions
- Admin Central
- Emergency Direct
- +91 86188 18012
- Maternity & Surgical Triage Line

### Topbar and account menu

- [Current page context]
- [Signed-in doctor name]
- [Doctor title / specialization]
- Fallbacks: Doctor Portal; Doctor; Care dashboard
- Account button accessible label: Open doctor account menu
- Profile
- Logout

### Mobile navigation

Home; Schedule; Patients; Cases; Rx; Slots; Payments.

### Footer

Developed by Ekathva Innvoations

(The current shared footer spells the company name “Innvoations”; retained here as written.)

## Patient summary card

- Patient avatar with verified icon.
- [Patient name]; fallback: Patient.
- [Appointment status badge]; initial/fallback: Active Patient. Dynamic statuses replace underscores with spaces.
- Age / Gender — [age formatted as “N Years” / gender].
- Contact — [phone, with email fallback].
- Last Visit — [appointment date currently used by this field].
- Blood Type — [patient blood type / blood group; clinical case-sheet blood group and Rh can update it].
- Email icon action — opens the patient's email address.
- Phone icon action — opens a telephone call link.
- Missing value placeholder: -
- Disabled action hints: Email is not available for this patient; Phone number is not available for this patient.

## Tab one Case History

### Clinical Case Sheet

- Clinical Case Sheet
- Patient Case ID — replaced with [the saved patient Case ID].
- Reload saved
- Print
- Save Case Sheet
- Loading case sheet...

The case sheet contains the following seven expandable groups. Chief complaints and Obstetric history are expanded initially. Dropdowns include the default option “Not recorded”. Textareas are three rows with a 10,000-character limit; ordinary text fields also have a 10,000-character limit. Numeric fields accept decimals within the listed ranges. Clinical field keys are supplied for reconnection, not as visible copy.

### Chief complaints

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Main complaints | Multiline text | — | `complaint` |
| Duration of complaints | Multiline text | — | `complaintDuration` |
| Associated symptoms | Multiline text | — | `symptoms` |
| Previous consultations and treatments | Multiline text | — | `previousTreatment` |
### Obstetric history

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Current pregnancy status | Dropdown | Not recorded; Yes; No; Unsure | `pregnancyStatus` |
| First day of last menstrual period (LMP) | Date | — | `lmp` |
| Cycle length for estimated due date (days; default 28) | Number | 20–44 | `cycleLength` |
| Assessment date for gestation | Date | — | `assessmentDate` |
| G / P / A / L | Text | — | `gpal` |
| Previous pregnancy delivery | Dropdown | Not recorded; PTVD; FTVD; Caesarean section; No previous pregnancy | `deliveryType` |
| Indication for Caesarean section | Multiline text | — | `caesareanIndication` |
| Previous pregnancy children | Repeatable child rows | See child-row details below | `children` |
| Previous pregnancy complications | Multiline text | — | `pastPregnancyComplications` |
| Current pregnancy complications | Multiline text | — | `pregnancyComplications` |
| Ultrasound (USG) reports available | Dropdown | Not recorded; Yes; No; Unsure | `usgAvailable` |
| Antenatal records available | Dropdown | Not recorded; Yes; No; Unsure | `antenatalRecords` |
| Blood group | Dropdown | Not recorded; A; B; AB; O | `bloodGroup` |
| Rh factor | Dropdown | Not recorded; Positive; Negative | `rh` |
| Anti-D administered | Dropdown | Not recorded; Yes; No; Unsure; shown when Rh factor = Negative | `antiD` |
| Indirect Coombs Test (ICT) performed | Dropdown | Not recorded; Yes; No; Unsure; shown when Rh factor = Negative | `ictPerformed` |
| ICT result | Dropdown | Not recorded; Negative; Positive; shown when Indirect Coombs Test (ICT) performed = Yes | `ictResult` |
| High-risk pregnancy | Dropdown | Not recorded; Yes; No; Unsure | `highRisk` |

Child-row content:

- Gender — dropdown: Not recorded; Male; Female; Other; Unknown.
- Age (years) — number, 0–120, step 0.1.
- Notes — text, maximum 1,000 characters.
- Remove — removes that child row; accessible label: Remove child row.
- Add child — adds another row; maximum 30 rows.

Calculated outputs and exact supporting copy:

- Estimated due date
- Gestation at assessment
- LMP estimate assumes a 28-day cycle unless adjusted. Confirm dating clinically.
- About estimated due dates

The assessment date initially uses today's date in Asia/Kolkata. EDD and gestation update from the entered pregnancy/LMP/date values; outputs are estimates.

### Menstrual history

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Menstrual cycle | Dropdown | Not recorded; Regular; Irregular; Missed | `cyclePattern` |
| Menstrual cycle length (days) | Number | 1–365 | `menstrualCycleLength` |
| Duration of menstrual bleeding (days) | Number | 0–90 | `bleedingDays` |
| Present menstrual / gynecological complaints | Checkbox group | Painful periods; Heavy Menstrual Bleeding (HMB); Irregular cycles; PMOS/PCOS; Discharge PV; Itching | `menstrualComplaints` |
| Other complaints | Multiline text | — | `otherMenstrualComplaints` |
| Marital status | Dropdown | Not recorded; Single; Married; Divorced; Widowed; Other; Prefer not to say | `maritalStatus` |
| Contraceptive use and details | Multiline text | — | `contraception` |
| Previous infertility investigations / workup | Multiline text | — | `infertilityWorkup` |
### Medical history

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Medical conditions | Checkbox group | Type 1 Diabetes Mellitus; Type 2 Diabetes Mellitus; Hypertension; Thyroid disorders; Bronchial Asthma; Coronary Artery Disease | `medicalConditions` |
| Other medical conditions | Multiline text | — | `otherMedicalConditions` |
| Past transfusions | Dropdown | Not recorded; Yes; No; Unsure | `transfusions` |
| Previous surgeries | Multiline text | — | `surgeries` |
| Drug allergies and details | Multiline text | — | `drugAllergies` |
### Family history

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Family history | Multiline text | — | `familyHistory` |
### Physical measurements

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Height (cm) | Number | 30–250 | `heightCm` |
| Weight (kg) | Number | 1–500 | `weightKg` |
| Waist circumference (cm) | Number | 10–300 | `waistCm` |
| Hip circumference (cm) | Number | 10–300 | `hipCm` |

Calculated output: BMI (kg/m²). Calculated from entered height and weight.

### Diagnosis and treatment plan

| Exact field label | Control | Choices or range | Field key |
| --- | --- | --- | --- |
| Provisional diagnosis | Multiline text | — | `diagnosis` |
| Treatment plan | Multiline text | — | `treatment` |
| Investigations advised | Multiline text | — | `investigations` |
| Follow-up required | Dropdown | Not recorded; Yes; No; Unsure | `followUpRequired` |
| Suggested follow-up date | Date | — | `followUpDate` |
| Referral required | Dropdown | Not recorded; Yes; No; Unsure | `referralRequired` |
| Referral details | Multiline text | — | `referralDetails` |

### Consultation Timeline

- Consultation Timeline
- Each expandable visit summary: [visit date] · [service type] · [doctor name].
- Current visit marker: (current visit)
- [Visit status].
- [Saved case-sheet fields and calculated outputs], or [existing observations/reason].
- Fallback: No structured case sheet recorded.
- Empty state: No previous visits.

### Saved revision history

- Saved revision history
- Each revision summary: Version [number] · [saved date/time] · [doctor name].
- Revision content uses the same clinical section labels, fields and calculated values.
- Empty state: No saved revisions yet.
- Empty fields are omitted from saved-history snapshots; the editable form's dropdown fallback is: Not recorded.

### Current consultation summary

- Current Consultation
- Consultation Summary — replaced by [service type] when available.
- [Consultation date]
- [Saved observations]
- Initial content: Loading case history...
- Empty state: No previous consultation notes recorded in the database.

### Consultation Notes

| Exact label | Control | Exact placeholder |
| --- | --- | --- |
| Chief Complaint & Observations | Textarea | Enter clinical observations, patient symptoms, and initial findings... |
| Recommended Actions | Text input | Blood Work Panel, Follow-up in 2 weeks |

Buttons:

- Draft Only
- Save Notes

Recommended Actions are entered as a comma-separated list. Save Notes updates the consultation to IN_PROGRESS; Draft Only saves the notes without requesting a status change. Mark as Completed saves the consultation notes and requests completion.

## Tab two New Prescription

### Prescription Builder

- Prescription Builder
- Creating digital record for this patient — initial supporting text.
- Dynamic supporting text: Creating digital record for Patient #[first eight characters of patient ID].
- Save Draft
- Save Prescription

### Prescription patient summary

- [Patient avatar]
- [Patient name]; fallback: Patient.
- [Appointment status]; fallback: Booked.
- Age and gender loading... — initial text.
- [Age / gender - patient phone or email] — loaded text.
- Blood Type
- [Blood type]; fallback: -

### Prescribed Medicines

- Prescribed Medicines

| Column label | Control | Placeholder or choices |
| --- | --- | --- |
| Medicine Name | Required text | Medicine |
| Dosage | Text | Dosage |
| Frequency | Dropdown | Frequency; Once daily; Twice daily; Three times daily; After meals; Before meals; As needed |
| Duration | Text | Duration |
| Instructions | Text | Instructions |
| [Remove action column] | Icon button | Tooltip: Remove medicine |

- Add Another Medicine
- The table starts with one editable row if no draft is loaded.
- Existing draft medications, advice and follow-up date can populate the builder.

### General Advice & Observations

- General Advice & Observations
- Textarea placeholder: Patient-specific advice, precautions, or clinical notes

### Follow-up Appointment

- Follow-up Appointment
- Date input.
- Supporting text: A notification can be sent to the patient before this date.

(This sentence is current UI copy. It is not a claim that outbound reminders are connected.)

### Handwritten Prescription Photo

- Handwritten Prescription Photo
- Upload a clear photo of a written prescription. It will be saved in the patient's documents.
- Title input placeholder: Photo title
- Initial title input value: Written Prescription Photo
- File picker accepts image/jpeg, image/png and image/webp.
- Upload Photo

### Saved Prescriptions

- Saved Prescriptions
- Each record shows [created date], [first medicine name / service / Prescription], [prescription status badge].
- Additional record text: [dosage - frequency - duration], with [service / status] fallback.
- [Advice], when present.
- Follow-up: [date], when present.
- Empty state: No prescriptions written yet.

## Shared right column

### Current Session

- Current Session
- [Session date]
- [Session time]
- [Service type]; fallback: Consultation.
- Join Google Meet
- Recommended Actions
- [Saved actions, each with check icon]
- Empty state: No recommended actions saved.

Google Meet is disabled for completed or cancelled appointments. It is available when a saved meeting link or Calendar event is present, with the server checking ownership and appointment status before redirecting.

Exact Meet status copy:

- Google Meet is unavailable for completed or cancelled appointments.
- Google Meet was not configured when this appointment was booked.
- A Google Meet link could not be created for this appointment.
- Google is still preparing the Meet link. Reload this page shortly.
- No Google Meet link is saved for this appointment.
- Disabled button tooltip: Google Meet is unavailable for completed or cancelled appointments

### Completion action

- Mark as Completed
- Completed — label after completion; the button is disabled.

### Uploaded Reports

- Uploaded Reports
- Each item: [document name], [document type - document date].
- Document type labels: Prescription Photo; Old Prescription; Report.
- View
- Download
- Empty state: No uploaded reports.

## Case-sheet print view

The Print action opens a separate text-based print view with all clinical sections and fields:

- Browser title: Clinical Case Sheet
- Sumohan Care · Clinical Case Sheet
- [Patient name]
- [Case ID]
- Consultation: [date/time]
- Current form contains unsaved changes — when relevant.
- Saved version [number] — otherwise.
- EDD: [value] · Gestation: [weeks]w [days]d · BMI: [value]
- Print / Save as PDF

## Exact status and feedback copy

### Appointment and notes

- Loading appointment context...
- Connected to PostgreSQL
- Loading prescriptions...
- Loading uploaded reports...
- Unable to load appointment.
- Appointment is already completed.
- Saving and completing appointment...
- Saving notes...
- Unable to save notes.
- Appointment completed.
- Notes saved.

### Case sheet

- Loading case sheet...
- Unsaved changes
- Saving case sheet…
- Saved version [number].
- No case sheet saved for this visit yet.
- Case sheet saved · Version [number]
- Unable to load case history.
- Could not save case sheet.
- Discard unsaved changes and load the latest saved case sheet?
- Allow the print window to open, then try again.

Unsaved case-sheet edits also trigger the browser's native leave-page confirmation. Server validation or stale-edit errors can appear in the case-sheet status area.

### Prescriptions

- Saving draft...
- Saving prescription...
- Add at least one medicine before saving.
- Unable to save prescription.
- Draft saved to database.
- Prescription saved for patient.
- Choose a prescription photo first.
- Uploading prescription photo...
- Unable to upload prescription photo.
- Prescription photo uploaded to patient documents.

## Behaviour that the redesigned UI must retain

- Switch between Case History and New Prescription while retaining the shared session and report context.
- Expand/collapse clinical groups, consultation history and revisions.
- Add/remove child rows; show conditional Rh/Anti-D/ICT fields.
- Recalculate EDD, gestation and BMI after changes.
- Save and reload the consultation-specific case sheet with revision/conflict handling.
- Print current clinical content, including unsaved form values with the unsaved warning.
- Save notes as a draft, save notes as in-progress, and mark the consultation completed.
- Add/remove medicine rows; save prescription drafts and completed prescriptions.
- Upload handwritten prescription photos and view saved prescriptions.
- View/download reports.
- Open email and phone actions only when contact data exists.
- Join Google Meet only when the appointment permits it.

## Implementation reference

Source page: doctor/appointment-details.html.

Dynamic sources: assets/js/clinical-schema.js; assets/js/case-history.js; assets/js/doctor-appointment-details.js. Shared navigation sources: doctor/sidebar.html; doctor/topbar.html; assets/js/aura-sidebar.js.

Keep the following identifiers available if returning new HTML; they are reconnection hooks, not visible labels.

### Static element IDs

- `appointment-detail-status`
- `appointment-patient-name`
- `appointment-patient-status`
- `appointment-patient-demographics`
- `appointment-patient-contact`
- `appointment-last-visit`
- `appointment-blood-type`
- `appointment-email-link`
- `appointment-phone-link`
- `case-patient-id`
- `case-reload`
- `case-print`
- `case-history-form`
- `case-fields`
- `case-history-save`
- `case-history-message`
- `case-timeline`
- `case-revisions`
- `case-title`
- `case-date`
- `case-summary`
- `consultation-observations`
- `consultation-actions`
- `consultation-save-draft`
- `consultation-save-notes`
- `consultation-notes-message`
- `prescription-record-label`
- `prescription-save-draft`
- `prescription-patient-name`
- `prescription-booking-status`
- `prescription-patient-meta`
- `prescription-patient-blood`
- `doctor-prescription-form`
- `prescription-medication-rows`
- `add-medicine-row`
- `doctor-prescription-message`
- `written-prescription-name`
- `written-prescription-photo`
- `upload-written-prescription`
- `written-prescription-message`
- `doctor-prescriptions-list`
- `appointment-session-date`
- `appointment-session-time`
- `appointment-service-type`
- `appointment-meet-link`
- `appointment-meet-status`
- `appointment-actions-list`
- `appointment-mark-completed`
- `recent-reports-list`

### Clinical fields

- Form field names must match the field keys in the seven clinical tables.
- Ordinary generated field IDs: `clinical-{fieldKey}`.
- Child-row attributes: `data-child="gender"`, `data-child="age"`, `data-child="notes"`, `data-remove-child`.
- Additional generated controls: `case-add-child`, `case-children`, `case-edd`, `case-pog`, `case-bmi`.

### Tab and medicine hooks

- `data-detail-tab="case"` / `data-detail-tab="prescription"`
- `data-detail-panel="case"` / `data-detail-panel="prescription"`
- `data-medication-row`
- `data-medication-field="name|dosage|frequency|duration|instructions"` (one value per control)
- `data-remove-medication`
- Prescription field names: `advice`; `followUpDate`.
