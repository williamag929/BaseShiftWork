/* ============================================================
   ShiftWork Marketing Site — main.js
   Nav, scroll reveal, stat counters, and lead capture.
   Leads persist to localStorage under "shiftwork_leads" and can
   optionally POST to a CRM/API endpoint (see LEAD_ENDPOINT).
   ============================================================ */

// Set to your API endpoint (e.g. "/api/leads") to also POST leads
// to a backend. Leave null to store leads in the browser only.
const LEAD_ENDPOINT = null;

const LEADS_KEY = "shiftwork_leads";

/* ---------- Navbar ---------- */
const navbar = document.getElementById("navbar");
const navToggle = document.getElementById("navToggle");

window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 10);
});

if (navToggle) {
  navToggle.addEventListener("click", () => {
    const open = navbar.classList.toggle("menu-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  // Close the mobile menu when a link is chosen
  document.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => navbar.classList.remove("menu-open"))
  );
}

/* ---------- Scroll reveal ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- Animated stat counters ---------- */
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll("[data-count]").forEach((el) => counterObserver.observe(el));

/* ---------- Lead capture form ---------- */
const leadForm = document.getElementById("leadForm");

function getLeads() {
  try {
    return JSON.parse(localStorage.getItem(LEADS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLead(lead) {
  const leads = getLeads();
  leads.unshift(lead);
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

if (leadForm) {
  leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate required fields
    let valid = true;
    leadForm.querySelectorAll("[required]").forEach((field) => {
      const ok = field.checkValidity();
      field.classList.toggle("invalid", !ok);
      if (!ok) valid = false;
    });
    if (!valid) return;

    const data = Object.fromEntries(new FormData(leadForm).entries());
    const lead = {
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
      ...data,
      status: "New",
      createdAt: new Date().toISOString(),
    };

    const submitBtn = document.getElementById("leadSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    saveLead(lead);

    if (LEAD_ENDPOINT) {
      try {
        await fetch(LEAD_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead),
        });
      } catch (err) {
        // Lead is already stored locally; backend sync is best-effort.
        console.warn("Lead endpoint unreachable:", err);
      }
    }

    leadForm.reset();
    submitBtn.textContent = "Request my demo";
    submitBtn.disabled = false;
    const success = document.getElementById("formSuccess");
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => (success.hidden = true), 8000);
  });

  // Clear error styling as the user types
  leadForm.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", () => field.classList.remove("invalid"));
  });
}

/* ---------- Footer year ---------- */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
