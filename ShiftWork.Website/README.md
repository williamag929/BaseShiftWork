# ShiftWork.Website

Marketing website for the **ShiftWork** platform — workforce scheduling and verified time tracking for construction, hospitality, and field-service teams.

The site is a static, dependency-free HTML/CSS/JS bundle, so it can be hosted anywhere (S3 + CloudFront, GitHub Pages, Netlify, Azure Static Web Apps, or served by the existing API).

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Marketing landing page: hero, features, how-it-works, industries, testimonials, pricing, FAQ, and a **demo-request (lead capture) form** |
| `leads.html` | Lightweight customer-lead tracker: lists demo requests, status pipeline (New → Contacted → Customer), CSV export |

## Structure

```
ShiftWork.Website/
├── index.html        # Landing page
├── leads.html        # Lead tracking dashboard
├── css/
│   └── styles.css    # All styling (responsive, no framework)
├── js/
│   ├── main.js       # Nav, scroll reveals, counters, lead form
│   └── leads.js      # Lead dashboard logic
└── README.md
```

## Running locally

No build step is required. Either open `index.html` directly in a browser, or serve the folder:

```powershell
# From ShiftWork.Website (any static server works)
npx serve .
# or
python -m http.server 8000
```

## Lead capture

When a visitor submits the "Request a demo" form:

1. The lead is saved to the browser's `localStorage` under the key `shiftwork_leads`.
2. Optionally, it is also POSTed as JSON to a backend endpoint.

To wire leads to your CRM or the ShiftWork API, set the endpoint at the top of [js/main.js](js/main.js):

```js
const LEAD_ENDPOINT = "https://your-api.example.com/api/leads";
```

The POSTed payload looks like:

```json
{
  "id": "uuid",
  "name": "Jane Smith",
  "company": "Acme Builders",
  "email": "jane@acme.com",
  "phone": "(555) 000-1234",
  "industry": "Construction",
  "teamSize": "11–50",
  "message": "Free text…",
  "status": "New",
  "createdAt": "2026-06-09T15:30:00.000Z"
}
```

> **Note:** `localStorage` is per-browser, so the `leads.html` dashboard only shows leads submitted from the same browser. For production use, configure `LEAD_ENDPOINT` and store leads server-side (e.g., a new `LeadsController` in `ShiftWork.Api`). The dashboard is intentionally simple and meant as a starting point.

## Customizing

- **Branding/colors:** edit the CSS variables at the top of [css/styles.css](css/styles.css) (`--amber`, `--navy-800`, etc.).
- **Copy & pricing:** all content lives directly in `index.html` — no templating.
- **Fonts:** Inter (body) and Sora (headings) are loaded from Google Fonts; swap the `<link>` tags to self-host.
