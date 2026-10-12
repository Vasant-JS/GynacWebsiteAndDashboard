(function () {
  const status = document.getElementById('doctor-profile-status');
  if (!status) return;

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value || '-';
  }

  function readStoredUser() {
    try {
      const user = JSON.parse(localStorage.getItem('auraSessionUser_DOCTOR') || localStorage.getItem('auraSessionUser') || 'null');
      return user && user.role === 'DOCTOR' ? user : null;
    } catch (_error) {
      return null;
    }
  }

  function renderProfile(user, sourceLabel) {
    const profile = user.profile || {};
    const title = profile.title || profile.designation || profile.specialization || 'Care dashboard';
    status.textContent = sourceLabel;
    setText('doctor-profile-name', user.displayName || user.display_name || 'Doctor');
    setText('doctor-profile-title', title);
    setText('doctor-profile-email', user.email);
    setText('doctor-profile-specialization', profile.specialization);
    setText('doctor-profile-experience', profile.experienceYears ? `${profile.experienceYears} years` : '-');
    setText('doctor-profile-fee', profile.consultationFee ? `INR ${profile.consultationFee}` : '-');
    setText('doctor-profile-languages', Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages);
  }

  async function loadProfile() {
    status.innerHTML = '<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>Loading profile...</span></span>';
    const storedUser = readStoredUser();
    if (storedUser) renderProfile(storedUser, 'Loaded from login profile');
    try {
      const response = await fetch('/api/auth/me?role=DOCTOR');
      const data = await response.json();
      const user = data.user;
      if (!response.ok || !user || user.role !== 'DOCTOR') throw new Error('Doctor session not found.');
      localStorage.setItem('auraSessionUser_DOCTOR', JSON.stringify(user));
      renderProfile(user, 'Connected to PostgreSQL');
    } catch (error) {
      if (!storedUser) status.textContent = error.message;
    }
  }

  loadProfile();
})();
