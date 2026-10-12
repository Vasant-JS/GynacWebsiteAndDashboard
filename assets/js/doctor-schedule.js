// Compatibility shim for older cached pages. New pages use doctor-appointments.js and doctor-slots.js.
(function () {
  const script = document.createElement('script');
  script.src = document.getElementById('availability-form') ? '/assets/js/doctor-slots.js' : '/assets/js/doctor-appointments.js';
  document.body.appendChild(script);
})();
