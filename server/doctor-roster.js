const roster = require('../assets/doctors.json');

// Retire previous roster entries without deleting their appointment history.
async function syncDoctorRoster(client) {
  for (const doctor of roster) {
    const existing = await client.query(
      "SELECT id FROM users WHERE role = 'DOCTOR' AND (metadata->>'rosterKey' = $1 OR display_name = $2) ORDER BY created_at LIMIT 1",
      [doctor.key, doctor.name],
    );
    const profile = {
      specialization: doctor.specialization,
      title: doctor.title || doctor.specialization,
      qualifications: doctor.qualifications,
      photoUrl: doctor.photoUrl,
    };
    const metadata = { rosterKey: doctor.key, source: 'sumohan_care_roster', retiredFromRoster: false };
    if (existing.rowCount) {
      await client.query(
        "UPDATE users SET display_name = $1, profile = profile || $2::jsonb, metadata = metadata || $3::jsonb, updated_at = now() WHERE id = $4",
        [doctor.name, JSON.stringify(profile), JSON.stringify(metadata), existing.rows[0].id],
      );
    } else {
      await client.query(
        "INSERT INTO users (role, display_name, profile, metadata) VALUES ('DOCTOR', $1, $2::jsonb, $3::jsonb)",
        [doctor.name, JSON.stringify(profile), JSON.stringify(metadata)],
      );
    }
  }
  await client.query(
    "UPDATE users SET status = 'INACTIVE', metadata = metadata || '{\"retiredFromRoster\":true}'::jsonb, updated_at = now() WHERE role = 'DOCTOR' AND NOT (COALESCE(metadata->>'rosterKey', '') = ANY($1::text[]))",
    [roster.map((doctor) => doctor.key)],
  );
}

module.exports = { syncDoctorRoster };
