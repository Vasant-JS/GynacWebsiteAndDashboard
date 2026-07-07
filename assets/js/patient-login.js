(function () {
  const loginPhase = document.getElementById('login-phase');
  const otpPhase = document.getElementById('otp-phase');
  const phoneInput = document.querySelector('[data-phone-input]');
  const whatsappInput = document.querySelector('[data-whatsapp-input]');
  const otpInput = document.querySelector('[data-otp-input]');
  const message = document.querySelector('[data-login-message]');
  const otpDisplay = document.querySelector('[data-otp-display]');
  let currentPhone = '';

  function showMessage(text, tone = 'info') {
    message.textContent = text;
    message.className = tone === 'error' ? 'mt-3 text-sm font-bold text-[#ba1a1a]' : 'mt-3 text-sm font-bold text-[#006a62]';
  }

  loginPhase?.addEventListener('submit', async (event) => {
    event.preventDefault();
    currentPhone = phoneInput.value.trim();
    showMessage('Generating OTP...');
    try {
      const response = await fetch('/api/auth/patient/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, whatsappNumber: whatsappInput.value.trim() || currentPhone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not generate OTP.');
      otpDisplay.textContent = data.otp;
      loginPhase.classList.add('hidden');
      otpPhase.classList.remove('hidden');
      showMessage(data.message);
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  otpPhase?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('Verifying OTP...');
    try {
      const response = await fetch('/api/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, otp: otpInput.value.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Invalid OTP.');
      window.location.href = data.redirectTo;
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });
})();
