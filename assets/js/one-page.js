(function () {
  const header = document.querySelector('header');
  function headerSize() {
    document.body.style.setProperty('--public-header-height', `${Math.ceil(header.getBoundingClientRect().height) + 16}px`);
  }
  headerSize();
  new ResizeObserver(headerSize).observe(header);
  document.addEventListener('click', event => {
    const service = event.target.closest('[data-service]');
    if (service) document.getElementById('public-booking-category').value = service.dataset.service;
    const doctor = event.target.closest('[data-booking-doctor]');

    const link = event.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href') === '#') return;
    const target = document.getElementById(link.hash.slice(1));
    if (target?.tagName === 'DETAILS') target.open = true;
  });
  document.getElementById('public-booking-form').addEventListener('submit', event => {
    event.preventDefault();
    const params = new URLSearchParams({ service: document.getElementById('public-booking-category').value });
    const doctor = document.getElementById('public-booking-doctor').value;

    if (document.getElementById('public-booking-type').value === 'FOLLOW_UP') params.set('type', 'follow-up');
    location.href = '/patient/login.html?next=' + encodeURIComponent('/patient/book-reason.html?' + params);
  });
})();
