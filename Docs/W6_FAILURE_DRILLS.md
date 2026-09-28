# W6 Failure Simulation Drills

**Branch:** `feature/professional-w6-observability` (from `develop`)
**Plan reference:** `Docs/PROFESSIONAL_DAILY_USE_PLAN.md` — Week 6

Purpose: concrete, repeatable steps to validate the runbooks in `Docs/W6_RUNBOOKS.md` actually
work, and that the alerts in `Docs/W6_DASHBOARDS_AND_ALERTS.md` actually fire. Run these against a
staging environment, never production. Each drill lists the injection method, the expected
detection signal, and which runbook it validates.

## Drill 1 — Database unreachable

**Inject:** point `DB_CONNECTION_STRING` at an unreachable host, or firewall off the SQL Server
port from the API container, then restart the `api` service.

**Expect:**
- `GET /health` still returns healthy (liveness only checks the process is up — no DB dependency).
- `GET /health/ready` returns unhealthy within the health check's evaluation window, surfacing
  `DatabaseHealthCheck`'s `"Cannot connect to the database."` message.
- Any endpoint touching data returns 500 with a paired `LogError` in the API logs.

**Validates:** Runbook 1, step 1–2. **Fix and confirm:** restore connectivity, re-check
`/health/ready` flips back to healthy without a restart (health checks re-evaluate on each poll).

## Drill 2 — S3 unreachable / bad credentials

**Inject:** temporarily set `AWS_S3_BUCKET_NAME` to a nonexistent bucket name (with
`AWS_S3_AUTO_CREATE` left at its normal staging value), or revoke the IAM role's S3 permissions.

**Expect:**
- Document upload (`InitiateUploadAsync`/`ConfirmUploadAsync` flow) and daily-report photo upload
  fail with an `AmazonS3Exception` logged by `AwsS3Service`.
- Bulletins, safety text content, and clock in/out continue to work normally — confirming the
  blast radius really is limited to file access, not the whole API.

**Validates:** Runbook 2, steps 1–2. **Fix and confirm:** restore the correct bucket
name/credentials, re-upload a test document successfully.

## Drill 3 — Push provider outage

**Inject:** point `EXPO_PUSH_API_URL` at an unreachable or 500-always endpoint, then publish a
test bulletin with `Status: Published` to a location with at least one registered device token.

**Expect:**
- `PushNotificationService` logs `LogError("Failed to send push notifications. Status: {Status},
  Error: {Error}", ...)`.
- The bulletin itself is still created and visible in-app (`GetBulletinsAsync`/`GetUnreadAsync`
  unaffected) — only the push alert is missing.
- No exception propagates to the caller — `CreateAsync` in `BulletinService` wraps
  `SendBulletinPushAsync` in try/catch, so bulletin creation itself must return 200/201 even
  when push fails. If this drill causes bulletin creation to fail outright, that's a regression in
  the push failure isolation, not expected behavior — fix it as a bug, not just document it.

**Validates:** Runbook 3, steps 1 and 4. **Fix and confirm:** restore `EXPO_PUSH_API_URL`, publish
another test bulletin, confirm the device receives it.

## Drill 4 — Kiosk post-clockout endpoint failure

**Inject:** temporarily break or slow (>5s) the two kiosk-facing endpoints
(`GET /bulletins/unread?priority=Urgent`, `GET /people/{personId}/safety/pending`) — e.g. via a
staging-only fault-injection middleware, or by pointing the Kiosk app's API base URL at a proxy
that delays/errors those two routes specifically.

**Expect:**
- The Kiosk app's interstitial auto-advances after 5 seconds (the W2 fallback) instead of hanging
  — clock-out itself must still succeed and the employee returns to the idle screen.
- No urgent bulletin or pending safety acknowledgment is silently lost from the *employee's*
  perspective being blocked — but per Runbook 1 step 5 and the dashboards spec §5, this failure is
  invisible to the employee by design, which is exactly why server-side alerting on this pair of
  endpoints matters. Confirm whatever alert/log signal you wired up for these two endpoints (spec
  §5) actually fires during this drill — if it doesn't fire, the alert isn't correctly configured,
  not that everything's fine.

**Validates:** Runbook 1 step 5, and the "kiosk interstitial failures" alert in
`Docs/W6_DASHBOARDS_AND_ALERTS.md` §5. **Fix and confirm:** remove the fault injection, confirm the
interstitial reliably shows real content again on the next clock-out.

## Drill 5 — Emergency rollback rehearsal

**Inject:** on a staging host with the same `docker compose` topology, deploy a deliberately broken
commit (e.g. one that throws on startup or 500s on every request), then execute Runbook 4's
rollback steps verbatim.

**Expect:**
- `git reset --hard <last-good-sha>` + `docker compose up -d --build mcp api web` restores service
  within a few minutes.
- `docker compose ps --filter 'status=running'` shows all 3 services running post-rollback.
- `/health` and `/health/ready` both report healthy afterward.

**Validates:** Runbook 4 end-to-end. This is the highest-value drill to actually run before
relying on the rollback runbook during a real incident — the other drills mostly validate
detection/alerting, this one validates the recovery *mechanism* itself works as written, on this
specific deployment topology.

## Cadence

Run Drill 5 at least once before the Week 6 go/no-go signoff (it's the one that would be most
damaging to discover doesn't work during a real incident). Run Drills 1–4 whenever the relevant
service (DB, S3, push, kiosk endpoints) changes meaningfully, or quarterly at minimum.
