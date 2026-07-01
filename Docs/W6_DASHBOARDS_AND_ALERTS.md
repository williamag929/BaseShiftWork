# W6 Dashboards & Alerts Spec

**Branch:** `feature/professional-w6-observability` (from `develop`)
**Plan reference:** `Docs/PROFESSIONAL_DAILY_USE_PLAN.md` — Week 6

## Current state (as found)

Before this sprint, the API had:
- Plain `ILogger<T>` structured logging via ASP.NET Core's default provider (console/debug sink
  only) — no external log aggregator, APM, or metrics exporter configured (no Serilog, no
  Application Insights, no OpenTelemetry, no Datadog agent).
- No health-check endpoint at all — nothing to point an uptime monitor or load balancer at.
- No dashboards, alerts, or on-call tooling connected to this repo.

This doc specifies what to build; it does not stand up real dashboards, since this session has no
authorized connection to an observability backend (Datadog, Grafana, etc. all require an
interactive OAuth grant this environment can't perform). Treat the queries/thresholds below as the
spec for whoever wires up the chosen tool.

## What this sprint added

- `ShiftWork.Api/Services/DatabaseHealthCheck.cs` — checks `ShiftWorkContext.Database.CanConnectAsync()`.
- `GET /health` — liveness probe, no dependency checks (process is up).
- `GET /health/ready` — readiness probe, runs checks tagged `"ready"` (currently: database).
- Point your load balancer / uptime monitor at `/health`; point k8s-style readiness probes or an
  "is the API actually usable" check at `/health/ready`.

## Metrics and alert definitions

Each entry lists: what to track, where the signal comes from today, and the alert threshold to
start with (tune after a week of real traffic).

### 1. API error rate
- **Signal:** HTTP 5xx response rate. Every controller in this codebase wraps its body in
  `try/catch` and returns `StatusCode(500, ...)` with a paired `_logger.LogError(ex, ...)` call
  (see `BulletinsController`, `DocumentsController`, `SafetyController`, `DailyReportsController`
  for the v2 modules — same pattern used app-wide).
- **How to collect:** either scrape ASP.NET Core's built-in `http.server.request.duration` /
  status-code metrics (available via `Microsoft.Extensions.Diagnostics.Metrics` + an
  OpenTelemetry exporter — not yet wired), or ingest the structured log stream and count
  `LogError` occurrences per endpoint.
- **Alert:** 5xx rate > 2% of requests over 5 minutes → warning; > 5% → page.

### 2. p95 latency
- **Signal:** request duration, same metrics source as above.
- **Priority endpoints:** the 4 v2 list endpoints (`GET .../bulletins`, `.../documents`,
  `.../safety`, `.../{locationId}/daily-reports`) since they're paginated and DB-query-heavy, plus
  `POST /api/auth/login` and `POST /api/kiosk/*/clock` (clocking is the P0 workflow per
  `PROFESSIONAL_DAILY_USE_PLAN.md`'s prioritization rules).
- **Alert:** p95 > 1.5s over 5 minutes on any priority endpoint → warning; > 3s → page.

### 3. Auth failures
- **Signal:** 401/403 response rate. Two auth schemes are registered in `Program.cs`
  (`AddJwtBearer` default = Firebase for web, `"ApiJwt"` = mobile) plus
  `PermissionAuthorizationHandler` for policy checks — a spike here usually means either a token
  issuer problem (expired signing key, clock skew) or an actual credential-stuffing attempt.
- **Also watch:** `AddRateLimiter` is configured in `Program.cs:152` — a spike in rate-limit
  rejections (HTTP 429) alongside 401s is a stronger signal of abuse than either alone.
- **Alert:** 401/403 rate > 10% of requests over 5 minutes → warning (check for a deploy that
  rotated a signing key); sudden spike (>3x baseline) → page (possible attack).

### 4. Push notification failures
- **Signal:** `PushNotificationService` already logs every failure mode with structured context:
  `LogWarning` for "no device tokens found" (benign — no page), `LogError` with the raw Expo
  response body on send failure, `LogWarning` per-ticket for individual delivery errors (invalid
  token, etc.), and a top-level `LogError(ex, "Error sending push notifications")` on exception.
- **Alert:** any `LogError("Failed to send push notifications...")` occurrence → warning (Expo API
  itself is degraded); if push failures correlate with a spike in "no device tokens found" alone,
  that's a mobile-app registration bug, not an outage — don't page on that pattern alone.

### 5. Kiosk interstitial failures
- **Signal:** the Kiosk RN app's interstitial screen (post-clockout bulletins/safety
  acknowledgments) already has a 5-second auto-advance fallback on load failure (added in W2 —
  see `PROFESSIONAL_DAILY_USE_PLAN.md`'s Week 2 summary) so a failure here is silent to the
  employee by design. That's exactly why it needs server-side visibility: add structured logging
  to the kiosk-facing endpoints (`GET /bulletins/unread?priority=Urgent`,
  `GET /people/{personId}/safety/pending`) if not already present, and alert on their error rate
  specifically, since a client-side silent fallback means no user will ever report this.
- **Alert:** any sustained error rate (>1% over 15 minutes) on the two kiosk post-clockout
  endpoints → warning, since safety acknowledgments silently not being surfaced is a compliance
  risk, not just a UX one.

## Suggested dashboard layout

One dashboard per audience:
- **API health** — error rate, p95/p99 latency, request volume, `/health` and `/health/ready`
  status, all split by endpoint group (auth, bulletins, documents, safety, daily-reports, kiosk).
- **Auth & security** — 401/403 rate, 429 (rate-limit) rate, JWT scheme breakdown (Firebase vs
  ApiJwt), overlaid with deploy markers (a spike right after a deploy usually means a config/key
  issue, not an attack).
- **Notifications** — push send success/failure rate, email send failures (SMTP config is in
  `CLAUDE.md`'s env var table), broken down by trigger (bulletin publish, safety publish,
  schedule/shift publish).

## Prerequisites to actually wire this up

1. Pick a backend (Datadog is already listed as an available-but-unauthorized MCP connector for
   this environment — `claude mcp` / `/mcp` in an interactive session to connect it).
2. Add an OpenTelemetry exporter (`OpenTelemetry.Extensions.Hosting` +
   `OpenTelemetry.Instrumentation.AspNetCore`) to `ShiftWork.Api` to get the request-duration/
   status-code metrics referenced above without hand-rolling counters.
3. Ship logs somewhere queryable (the current console-only sink means logs only exist in whatever
   captures stdout — fine for local `dotnet run`, not sufficient for production alerting).
