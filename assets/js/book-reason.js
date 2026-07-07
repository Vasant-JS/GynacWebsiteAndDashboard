(function () {
  const form = document.getElementById('book-reason-form');
  const cards = Array.from(document.querySelectorAll('[data-reason]'));
  const otherInput = document.getElementById('other-reason-input');
  const message = document.getElementById('book-reason-message');
  let selected = '';

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((item) => item.classList.remove('ring-2', 'ring-[#b0004a]'));
      card.classList.add('ring-2', 'ring-[#b0004a]');
      selected = card.dataset.reason;
      if (selected === 'Something Else') otherInput.focus();
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const reason = selected || 'Something Else';
    try {
      const response = await fetch('/api/patient/booking/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, otherReason: otherInput.value.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save reason.');
      window.location.href = data.redirectTo;
    } catch (error) {
      message.textContent = error.message;
    }
  });
})();
