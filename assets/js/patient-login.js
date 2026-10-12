(function () {
  const loginPhase = document.getElementById('login-phase');
  const otpPhase = document.getElementById('otp-phase');
  const phoneInput = document.querySelector('[data-phone-input]') || loginPhase?.querySelector('input[type="tel"]');
  const whatsappInput = document.querySelector('[data-whatsapp-input]');
  const otpInput = document.querySelector('[data-otp-input]');
  const otpBoxes = Array.from(otpPhase?.querySelectorAll('input[maxlength="1"]') || []);
  const message = document.querySelector('[data-login-message]') || document.createElement('p');
  const otpDisplay = document.querySelector('[data-otp-display]');
  const sendButton = document.querySelector('[data-send-otp]') || loginPhase?.querySelector('button');
  const verifyButton = document.querySelector('[data-verify-otp]') || otpPhase?.querySelector('button');
  const resendButton = document.querySelector('[data-resend-otp]');
  let currentPhone = '';
  let resendTimer = null;

  if (!message.isConnected && loginPhase) {
    message.className = 'mt-3 text-sm font-bold text-[#006a62]';
    (otpPhase?.parentElement || loginPhase.parentElement || loginPhase).appendChild(message);
  }

  function showMessage(text, tone = 'info') {
    message.textContent = text;
    message.className = tone === 'error' ? 'mt-3 text-sm font-bold text-[#ba1a1a]' : 'mt-3 text-sm font-bold text-[#006a62]';
  }

  function showRegisterPrompt(text) {
    message.innerHTML = `${text} <a class="underline" href="/patient/register.html">Register as patient</a>`;
    message.className = 'mt-3 text-sm font-bold text-[#ba1a1a]';
  }

  function otpValue() {
    if (otpInput) return otpInput.value.trim();
    return otpBoxes.map((input) => input.value.trim()).join('');
  }

  function fillOtpBoxes(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, otpBoxes.length);
    otpBoxes.forEach((input, index) => {
      input.value = digits[index] || '';
    });
    const nextIndex = Math.min(digits.length, otpBoxes.length - 1);
    otpBoxes[nextIndex]?.focus();
  }

  function clearOtpBoxes() {
    otpBoxes.forEach((input) => {
      input.value = '';
    });
    if (otpInput) otpInput.value = '';
    otpBoxes[0]?.focus();
  }

  function formatCountdown(seconds) {
    return `0:${String(seconds).padStart(2, '0')}`;
  }

  function startResendCountdown(seconds = 60) {
    if (!resendButton) return;
    window.clearInterval(resendTimer);
    let remaining = seconds;
    resendButton.disabled = true;
    resendButton.textContent = `Resend Code (${formatCountdown(remaining)})`;
    resendTimer = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(resendTimer);
        resendButton.disabled = false;
        resendButton.textContent = 'Resend Code';
        return;
      }
      resendButton.textContent = `Resend Code (${formatCountdown(remaining)})`;
    }, 1000);
  }

  function bindOtpBoxes() {
    otpBoxes.forEach((input, index) => {
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', index === 0 ? 'one-time-code' : 'off');

      input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '');
        if (digits.length > 1) {
          fillOtpBoxes(digits);
          return;
        }
        input.value = digits;
        if (digits && index < otpBoxes.length - 1) otpBoxes[index + 1].focus();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !input.value && index > 0) {
          otpBoxes[index - 1].focus();
          otpBoxes[index - 1].value = '';
        }
        if (event.key === 'ArrowLeft' && index > 0) otpBoxes[index - 1].focus();
        if (event.key === 'ArrowRight' && index < otpBoxes.length - 1) otpBoxes[index + 1].focus();
      });

      input.addEventListener('paste', (event) => {
        event.preventDefault();
        fillOtpBoxes(event.clipboardData?.getData('text') || '');
      });
    });
  }

  async function requestOtp(event, options = {}) {
    event?.preventDefault();
    currentPhone = (currentPhone || phoneInput?.value || '').trim();
    if (!currentPhone) {
      showMessage('Enter your registered 10-digit mobile number.', 'error');
      return;
    }
    const triggerButton = options.resend ? resendButton : sendButton;
    if (triggerButton) triggerButton.disabled = true;
    showMessage(options.resend ? 'Generating a new OTP...' : 'Generating OTP...');
    try {
      const response = await fetch('/api/auth/patient/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, whatsappNumber: whatsappInput?.value.trim() || currentPhone }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404 && data.redirectTo) {
          showRegisterPrompt(data.message || 'This mobile number is not registered.');
          return;
        }
        throw new Error(data.message || 'Could not generate OTP.');
      }
      clearOtpBoxes();
      if (otpDisplay) otpDisplay.textContent = data.otp;
      else showMessage(`${data.message} OTP: ${data.otp}`);
      loginPhase.classList.add('hidden');
      otpPhase.classList.remove('hidden');
      startResendCountdown();
      otpBoxes[0]?.focus();
    } catch (error) {
      showMessage(error.message, 'error');
      if (triggerButton) triggerButton.disabled = false;
    } finally {
      if (!options.resend && sendButton) sendButton.disabled = false;
    }
  }

  async function verifyOtp(event) {
    event?.preventDefault();
    showMessage('Verifying OTP...');
    try {
      const response = await fetch('/api/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, otp: otpValue() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Invalid OTP.');
      if (data.user) localStorage.setItem(`auraSessionUser_${data.user.role}`, JSON.stringify(data.user));
      window.location.href = data.redirectTo;
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  sendButton?.addEventListener('click', requestOtp);
  phoneInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') requestOtp(event);
  });

  verifyButton?.addEventListener('click', verifyOtp);
  resendButton?.addEventListener('click', (event) => requestOtp(event, { resend: true }));
  otpBoxes.forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') verifyOtp(event);
    });
  });
  bindOtpBoxes();
})();
