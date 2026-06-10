// Mobile nav toggle
const toggle = document.getElementById('navToggle');
const menu = document.getElementById('navMenu');

toggle.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
  toggle.setAttribute('aria-expanded', isOpen);
});

// Close nav when a link is clicked
menu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', false);
  });
});

// CTA form — wire to your email service (Formspree, Mailchimp, etc.)
const form = document.getElementById('ctaForm');
const msg = document.getElementById('formMessage');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('ctaEmail').value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'form-note error';
    return;
  }

  // TODO: replace with your actual endpoint (Formspree, Mailchimp, custom API)
  // Example Formspree: const res = await fetch('https://formspree.io/f/YOUR_ID', { ... })
  msg.textContent = 'Thanks! Check your inbox to get started.';
  msg.className = 'form-note success';
  form.reset();
});
