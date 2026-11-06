# Patient dashboard UI redesign prompt

Redesign the **Sumohan Care patient dashboard** as one responsive overview page. Build the design for a mobile screen first (320–430 px wide), then adapt it for tablet and desktop. Use the existing brand palette: rose `#b0004a`, teal `#006a62`, deep blue `#000767`, pale lavender `#fbf8ff`, and white. The current UI uses Manrope and Material Symbols. Keep typography restrained: about 25–30 px for the page greeting on mobile, 17–20 px for section headings, 14–16 px for body text, and 12–14 px for secondary labels. Avoid horizontal scrolling, oversized headings, and excessive empty space. Touch targets should be at least 44 px.

## Current dashboard content and behavior

- A Sumohan Care header with the patient's account menu (profile and logout); mobile navigation has Home, Visits, Reports, and Profile. Desktop has a sidebar with the same main routes and a booking action.
- Personalized greeting using the signed-in patient's name, short summary, and **Book consultation** action.
- **Upcoming appointment** preview: doctor, service type, date, time, location, status or empty state. It can show View Appointment and a Google Meet link when available. Add **View all** to `/patient/appointments.html`.
- **Wellness Insight** card with care-related copy and a route to the patient's profile. Do not invent medical advice or clinical measurements.
- **Recent Prescriptions** preview: medication name and available dosage, frequency, and duration; otherwise status/date. Add **View all** to `/patient/reports.html?tab=prescriptions`.
- **Recent Reports** preview: report name, report date/status, and a download action when a file exists. Add **View all** to `/patient/reports.html`.
- **Appointment History** preview: service, doctor, date, status, and View Details. Add **View all** to `/patient/appointments.html?tab=past`. On mobile, use stacked visit cards instead of a wide table.
- Each section needs a clear loading state and a helpful empty state. Content comes from the signed-in patient's records; do not use sample patient names, fake appointments, or invented results.

## Connected detail pages

- `/patient/appointments.html`: full future and past bookings, new and follow-up booking, rescheduling/cancellation, and appointment feedback where available.
- `/patient/reports.html`: uploaded reports and doctor prescriptions, plus report upload.
- `/patient/profile.html`: patient details and profile editing.
- `/patient/book-reason.html`: start a new consultation; `?type=follow-up` starts a follow-up.

## Layout request

Create **one dashboard overview page with all sections visible in a single vertical scroll**. Each section should show only a short preview and have a clearly labeled **View all** button or link that opens its corresponding detail page. Make the upcoming appointment the primary card, then place prescriptions, reports, and visit history in a natural reading order. Keep booking prominent without repeating large CTAs throughout the screen. Use compact cards, consistent spacing, readable contrast, and a fixed mobile bottom navigation that does not cover page content. On desktop, use the available width without stretching content excessively.

Keep the existing routes and data fields. Produce a polished mobile screen and its desktop adaptation, including populated, loading, and empty states.
