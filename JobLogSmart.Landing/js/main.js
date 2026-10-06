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

// CTA form
// Until a real signup/lead endpoint exists, the form must not pretend the
// email was received. Set LEAD_ENDPOINT to a URL that accepts a JSON POST
// (Formspree, Mailchimp, or a future Loqzen API route) to collect leads
// silently. While it is empty, the form opens a pre-filled email to
// hello@loqzen.com so no request is ever lost.
const LEAD_ENDPOINT = '';
const CONTACT_EMAIL = 'hello@loqzen.com';

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

  if (LEAD_ENDPOINT) {
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email, source: 'loqzen-landing', createdAt: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      msg.textContent = "Thanks! We'll email you at " + email + ' to get your account set up.';
      msg.className = 'form-note success';
      form.reset();
    } catch (err) {
      msg.textContent = 'Something went wrong. Please email ' + CONTACT_EMAIL + ' and we will set you up.';
      msg.className = 'form-note error';
    }
    return;
  }

  const subject = encodeURIComponent('Loqzen free trial request');
  const body = encodeURIComponent('Hi Loqzen team,\n\nI would like to start a free trial.\nMy work email: ' + email + '\n');
  window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
  msg.textContent = 'Your email app should open with a pre-filled message. Just hit send, or write to ' + CONTACT_EMAIL + '.';
  msg.className = 'form-note success';
});

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();