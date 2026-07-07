function whatsappUrl(phone, text) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

async function createConsultationMeeting({ appointmentId, appointmentAt, serviceType, patient, doctor }) {
  const meetLink = `https://meet.google.com/dev-${String(appointmentId).slice(0, 3)}-${String(appointmentId).slice(3, 7)}-${String(appointmentId).slice(7, 10)}`;
  const message = `Aura Health appointment confirmed with ${doctor.display_name || doctor.displayName || 'doctor'} for ${serviceType} at ${appointmentAt}. Meet link: ${meetLink}`;
  return {
    provider: 'google_meet',
    mode: 'development_placeholder',
    meetLink,
    shareText: message,
    whatsappShareUrl: whatsappUrl(patient.profile?.whatsappNumber || patient.phone, message),
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createConsultationMeeting };
