# Aura Health Gynecologist Consultation Website

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

Seed logins:

- Doctor: `doctor@aura.test` / `doctor123`
- Admin: `admin@aura.test` / `admin123`

Patient OTP is generated and shown on screen in development.
