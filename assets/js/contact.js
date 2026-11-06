(function () {
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button'); const message = document.getElementById('contact-message');
    button.disabled = true;
    try {
      const response = await fetch('/api/public/contact', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      message.textContent = `${data.message} Reference: ${data.reference}`; form.reset();
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
})();
