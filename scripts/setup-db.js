require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const dbName = process.env.PGDATABASE || 'femmecare';

function baseConfig(database) {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${database}`;
    return { connectionString: url.toString() };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database,
  };
}

async function createDatabaseIfNeeded() {
  const client = new Client(baseConfig('postgres'));
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database ${dbName}`);
  }
  await client.end();
}

async function setupSchema() {
  const client = new Client(baseConfig(dbName));
  await client.connect();

  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await client.query(`
    DO $$ BEGIN CREATE TYPE user_role AS ENUM ('ADMIN', 'DOCTOR', 'PATIENT');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      role user_role NOT NULL,
      status user_status NOT NULL DEFAULT 'ACTIVE',
      display_name text NOT NULL,
      email text,
      phone text,
      password_hash text,
      profile jsonb NOT NULL DEFAULT '{}'::jsonb,
      preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email) WHERE email IS NOT NULL');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx ON users (phone) WHERE phone IS NOT NULL');
  await client.query('CREATE INDEX IF NOT EXISTS users_profile_gin_idx ON users USING gin (profile)');
  await client.query('CREATE INDEX IF NOT EXISTS users_metadata_gin_idx ON users USING gin (metadata)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS otp_challenges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      destination text NOT NULL,
      channel text NOT NULL DEFAULT 'SCREEN',
      otp_code text NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS otp_challenges_lookup_idx ON otp_challenges (destination, otp_code, expires_at)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS entity_attributes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text NOT NULL,
      attribute_key text NOT NULL,
      label text NOT NULL,
      data_type text NOT NULL DEFAULT 'text',
      is_required boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT true,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (entity_type, attribute_key)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      patient_id uuid REFERENCES users(id) ON DELETE SET NULL,
      appointment_at timestamptz NOT NULL,
      duration_minutes integer NOT NULL DEFAULT 30,
      service_type text NOT NULL,
      status text NOT NULL DEFAULT 'SCHEDULED',
      location text,
      notes jsonb NOT NULL DEFAULT '{}'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS appointments_doctor_time_idx ON appointments (doctor_id, appointment_at)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS doctor_availability (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      available_date date NOT NULL,
      is_available boolean NOT NULL DEFAULT true,
      slots text[] NOT NULL DEFAULT '{}'::text[],
      notes jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (doctor_id, available_date)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
      doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      patient_id uuid REFERENCES users(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'DRAFT',
      medications jsonb NOT NULL DEFAULT '[]'::jsonb,
      instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS medical_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid REFERENCES users(id) ON DELETE CASCADE,
      appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
      uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
      document_type text NOT NULL,
      name text NOT NULL,
      document_date date,
      file_name text,
      file_path text,
      mime_type text,
      status text NOT NULL DEFAULT 'UPLOADED',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
      patient_id uuid REFERENCES users(id) ON DELETE SET NULL,
      amount numeric(12,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'INR',
      status text NOT NULL DEFAULT 'PENDING',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      body text NOT NULL,
      category text NOT NULL DEFAULT 'INFO',
      is_read boolean NOT NULL DEFAULT false,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS session (
      sid varchar NOT NULL COLLATE "default",
      sess json NOT NULL,
      expire timestamp(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid)
    )
  `);

  const doctorHash = await bcrypt.hash('doctor123', 10);
  const adminHash = await bcrypt.hash('admin123', 10);
  const patientHash = await bcrypt.hash('patient-dev-only', 10);

  await client.query(
    `
      INSERT INTO users (role, display_name, email, password_hash, profile, metadata)
      VALUES
        ('DOCTOR', 'Dr. Elena Rossi', 'doctor@aura.test', $1, $2, '{"seed":true}'),
        ('ADMIN', 'Super Admin', 'admin@aura.test', $3, $4, '{"seed":true}')
      ON CONFLICT (email) WHERE email IS NOT NULL
      DO UPDATE SET password_hash = EXCLUDED.password_hash, profile = EXCLUDED.profile, updated_at = now()
    `,
    [
      doctorHash,
      { specialization: 'Gynecology', experienceYears: 15, consultationFee: 800, dashboard: 'doctor' },
      adminHash,
      { dashboard: 'admin', permissions: ['*'] },
    ],
  );

  const seededUsers = await client.query('SELECT id, role, email FROM users WHERE email IN ($1, $2)', ['doctor@aura.test', 'admin@aura.test']);
  const doctor = seededUsers.rows.find((user) => user.role === 'DOCTOR');
  const patients = await client.query(
    `
      INSERT INTO users (role, display_name, email, phone, password_hash, profile, metadata)
      VALUES
        ('PATIENT', 'Sarah Mitchell', 'sarah.patient@aura.test', '8892498859', $1, $2, '{"seed":true}'),
        ('PATIENT', 'Amanda K. Reed', 'amanda.patient@aura.test', '+919876543211', $1, $3, '{"seed":true}'),
        ('PATIENT', 'Beatrice Vance', 'beatrice.patient@aura.test', '+919876543212', $1, $4, '{"seed":true}')
      ON CONFLICT (email) WHERE email IS NOT NULL
      DO UPDATE SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone, profile = EXCLUDED.profile, updated_at = now()
      RETURNING id, display_name, email
    `,
    [
      patientHash,
      { age: 31, currentConcern: 'Prenatal Checkup - Week 24', bloodGroup: 'O+', whatsappNumber: '918892498859' },
      { age: 36, currentConcern: 'Diagnostic Ultrasound Review', bloodGroup: 'A+' },
      { age: 29, currentConcern: 'Bloodwork Review', bloodGroup: 'B+' },
    ],
  );

  if (doctor && patients.rowCount) {
    await client.query('DELETE FROM notifications WHERE user_id = $1 AND metadata->>\'seed\' = \'true\'', [doctor.id]);
    await client.query('DELETE FROM payments WHERE metadata->>\'seed\' = \'true\'');
    await client.query('DELETE FROM appointments WHERE doctor_id = $1 AND metadata->>\'seed\' = \'true\'', [doctor.id]);
    await client.query('DELETE FROM prescriptions WHERE doctor_id = $1 AND metadata->>\'seed\' = \'true\'', [doctor.id]);
    await client.query('DELETE FROM medical_documents WHERE metadata->>\'seed\' = \'true\'');
    const [sarah, amanda, beatrice] = patients.rows;
    const seededAppointments = await client.query(
      `
        INSERT INTO appointments (doctor_id, patient_id, appointment_at, service_type, status, location, notes, metadata)
        VALUES
          ($1, $2, now()::date + time '09:30', 'Prenatal Checkup', 'IN_PROGRESS', 'Aura Boutique Clinic, Wing A, Room 402', '{"trimester":"second"}', '{"seed":true,"priority":"normal"}'),
          ($1, $3, now()::date + time '10:15', 'Diagnostic Ultrasound Review', 'SCHEDULED', 'Aura Boutique Clinic, Wing A, Room 405', '{"scanType":"pelvic"}', '{"seed":true,"priority":"normal"}'),
          ($1, $4, now()::date + time '11:00', 'Bloodwork Review', 'SCHEDULED', 'Virtual Consultation', '{"report":"Full Blood Count"}', '{"seed":true,"priority":"follow-up"}')
        RETURNING id, patient_id, service_type
      `,
      [doctor.id, sarah.id, amanda.id, beatrice.id],
    );
    for (const appointment of seededAppointments.rows) {
      await client.query(
        'INSERT INTO payments (appointment_id, patient_id, amount, currency, status, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          appointment.id,
          appointment.patient_id,
          appointment.service_type === 'Prenatal Checkup' ? 1200 : 800,
          'INR',
          appointment.service_type === 'Prenatal Checkup' ? 'PAID' : 'PENDING',
          { seed: true, source: 'db_setup' },
        ],
      );
    }
    await client.query(
      `
        INSERT INTO prescriptions (doctor_id, patient_id, status, medications, instructions, metadata)
        VALUES
          ($1, $2, 'FINAL', '[{"name":"Iron Supplement Forte","dosage":"1 tablet","frequency":"Daily","duration":"20 days"}]', '{"advice":"Take after breakfast."}', '{"seed":true}'),
          ($1, $3, 'PENDING_REVIEW', '[{"name":"Prenatal Multi-Vitamin","frequency":"After food"}]', '{}', '{"seed":true}')
      `,
      [doctor.id, sarah.id, amanda.id],
    );
    await client.query(
      `
        INSERT INTO medical_documents (patient_id, uploaded_by, document_type, name, document_date, file_name, file_path, mime_type, metadata)
        VALUES ($1, $1, 'REPORT', 'Full Blood Count', current_date - interval '2 days', 'sample-report.txt', '/uploads/sample-report.txt', 'text/plain', '{"seed":true}')
      `,
      [sarah.id],
    );
    await client.query(
      `
        INSERT INTO notifications (user_id, title, body, category, metadata)
        VALUES
          ($1, 'Lab Reports Uploaded', 'New bloodwork results available for Beatrice Vance.', 'REPORT', '{"seed":true}'),
          ($1, 'New Booking', 'Emergency consult requested for tomorrow at 08:00 AM.', 'BOOKING', '{"seed":true}'),
          ($1, 'Internal Message', 'Case file shared for the Friday procedure.', 'MESSAGE', '{"seed":true}')
      `,
      [doctor.id],
    );
  }

  await client.query(
    `
      INSERT INTO entity_attributes (entity_type, attribute_key, label, data_type, config)
      VALUES
        ('PATIENT', 'age', 'Age', 'number', '{"section":"basic"}'),
        ('PATIENT', 'cycleHistory', 'Cycle History', 'json', '{"section":"medical"}'),
        ('PATIENT', 'insuranceDetails', 'Insurance Details', 'json', '{"section":"billing"}'),
        ('DOCTOR', 'specialization', 'Specialization', 'text', '{"section":"professional"}')
      ON CONFLICT (entity_type, attribute_key) DO NOTHING
    `,
  );

  await client.end();
}

createDatabaseIfNeeded()
  .then(setupSchema)
  .then(() => {
    console.log('PostgreSQL schema is ready.');
    console.log('Seed logins: doctor@aura.test / doctor123, admin@aura.test / admin123');
  })
  .catch((error) => {
    console.error('Database setup failed.');
    console.error(error.message || error.code || error.name);
    if (error.errors) error.errors.forEach((inner) => console.error(`${inner.code || inner.name}: ${inner.message}`));
    process.exit(1);
  });
