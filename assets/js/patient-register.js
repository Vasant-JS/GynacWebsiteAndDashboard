(function () {
  const form = document.getElementById('patient-register-form');
  const message = document.getElementById('patient-register-message');
  const mobileInput = form?.elements.mobile;
  const nameInput = form?.elements.name;
  const ageInput = form?.elements.age;
  const emailInput = form?.elements.email;

  function showMessage(text, tone = 'info') {
    if (!message) return;
    message.textContent = text;
    message.className = `mt-5 text-sm font-bold ${tone === 'error' ? 'text-error' : 'text-secondary'}`;
  }

  function mobileValue() {
    return String(mobileInput?.value || '').replace(/\D/g, '').slice(0, 10);
  }

  mobileInput?.addEventListener('input', () => {
    mobileInput.value = mobileValue();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!/^[A-Za-z][A-Za-z\s.'-]{1,79}$/.test(String(nameInput?.value || '').trim())) {
      showMessage('Enter a valid full name.', 'error');
      nameInput?.focus();
      return;
    }
    if (!Number.isInteger(Number(ageInput?.value)) || Number(ageInput?.value) < 1 || Number(ageInput?.value) > 120) {
      showMessage('Enter a valid age.', 'error');
      ageInput?.focus();
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobileValue())) {
      showMessage('Enter a valid 10-digit mobile number without +91.', 'error');
      mobileInput?.focus();
      return;
    }
    if (!emailInput?.checkValidity()) {
      showMessage('Enter a valid email address.', 'error');
      emailInput?.focus();
      return;
    }
    const formData = new FormData(form);
    const body = {
      name: formData.get('name'),
      age: Number(formData.get('age')),
      mobile: mobileValue(),
      email: formData.get('email'),
      history: formData.get('history'),
      allergies: formData.get('allergies'),
      diabetes: formData.has('diabetes'),
      bloodPressure: formData.has('bloodPressure'),
      otherConditions: formData.get('otherConditions'),
    };

    showMessage('Saving patient registration...');
    try {
      const response = await fetch('/api/auth/patient/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not register patient.');
      showMessage(data.message || 'Registration completed.');
      window.location.href = data.redirectTo || '/patient/login.html?registered=1';
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });
})();
