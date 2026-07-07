(function () {
  const form = document.getElementById('staff-login-form');
  const email = document.getElementById('staff-email');
  const password = document.getElementById('staff-password');
  const message = document.getElementById('staff-login-message');
  const roleInputs = Array.from(document.querySelectorAll('input[name="role"]'));

  function applyDefaults() {
    const role = roleInputs.find((input) => input.checked)?.value || 'DOCTOR';
    if (role === 'ADMIN') {
      email.value = 'admin@aura.test';
      password.value = 'admin123';
    } else {
      email.value = 'doctor@aura.test';
      password.value = 'doctor123';
    }
  }

  roleInputs.forEach((input) => input.addEventListener('change', applyDefaults));
  applyDefaults();

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = 'Signing in...';
    try {
      const role = roleInputs.find((input) => input.checked)?.value || 'DOCTOR';
      const response = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email: email.value, password: password.value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed.');
      window.location.href = data.redirectTo;
    } catch (error) {
      message.textContent = error.message;
    }
  });
})();
