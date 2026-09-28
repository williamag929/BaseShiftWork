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

**Update:** this is now actually stood up — self-hosted Prometheus + Grafana, added to the root
`docker-compose.yml` alongside `mssql`/`api`/`web`/`mcp` (the same compose file
`.github/workflows/deploy.yml` already deploys to the real host). No SaaS OAuth grant was needed for
this: the queries/thresholds below are implemented directly against ASP.NET Core's built-in
`http.server.request.duration` metric (via `OpenTelemetry.Instrumentation.AspNetCore`, added to
`ShiftWork.Api`) plus two custom counters in `Helpers/AppMetrics.cs` for the two signals that aren't
naturally HTTP-request-shaped (§4, §5).

### Running it

```
docker compose up -d --build api prometheus grafana   # (plus mssql if not already running)
```
- Grafana: `http://localhost:3000` (or your deploy host's port 3000) — login `admin` /
  `$GRAFANA_ADMIN_PASSWORD`. All 3 dashboards below and all 5 alert rules are pre-provisioned on
  first boot from `observability/grafana/provisioning/` — nothing to click through manually.
- Prometheus: `http://localhost:9090` — `/targets` should show `shiftwork-api` as **UP**.
- `/metrics` on the API requires a bearer token (`METRICS_SCRAPE_TOKEN` env var) — it's reachable on
  the host-mapped port in production, so it's gated rather than left open; Prometheus reads the
  token from a file it writes at container start (see `observability/prometheus/prometheus.yml`'s
  comments — Prometheus doesn't expand `${ENV_VAR}` in its own config, so this isn't as simple as
  templating the YAML directly).
- Alert notifications go to `GRAFANA_ALERT_EMAIL` via the app's existing `SMTP_*` credentials — no
  new notification channel was set up. Firing state is visible in Grafana's Alerting page regardless
  of whether SMTP is configured.
- New env vars, documented in `.env.example`: `METRICS_SCRAPE_TOKEN`, `GRAFANA_ADMIN_PASSWORD`,
  `GRAFANA_ALERT_EMAIL`.

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

## Status of the 3 original prerequisites

1. ~~Pick a backend~~ — done: self-hosted Prometheus + Grafana, no SaaS OAuth needed.
2. ~~Add an OpenTelemetry exporter~~ — done: `OpenTelemetry.Extensions.Hosting` +
   `OpenTelemetry.Instrumentation.AspNetCore` + `OpenTelemetry.Exporter.Prometheus.AspNetCore` are
   in `ShiftWork.Api.csproj`; wired in `Program.cs`.
3. **Still open:** logs are still console-only (no Loki/ELK/similar). Not needed for the 5 alerts
   here — §1-3 are HTTP-metric-based and §4-5 use the two custom counters instead of parsing logs —
   but still true that logs themselves aren't shipped anywhere queryable if you need to grep them
   during an incident rather than SSH into the host.

Two real bugs were found and fixed while wiring this up, both exactly the visibility gaps this spec
already called out: `KioskController` had no `ILogger` at all (its 3 catch blocks silently swallowed
exceptions — including the exact post-clockout endpoint §5 needs signal from), and
`PermissionAuthorizationHandler`/`AuthController.Login`'s auth-failure paths are still unlogged
(noted, not fixed — §3's alert doesn't need it since it's HTTP-status-code-based).
