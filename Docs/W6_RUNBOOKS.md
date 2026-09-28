# W6 Runbooks

**Branch:** `feature/professional-w6-observability` (from `develop`)
**Plan reference:** `Docs/PROFESSIONAL_DAILY_USE_PLAN.md` — Week 6

These runbooks assume the deployment topology in `.github/workflows/deploy.yml`: a single remote
host reached over SSH, running `docker compose` with services named `mcp`, `api`, `web` (this
repo's `ShiftWork.Api` and `ShiftWork.Angular`, plus the MCP server). Deploys happen by SSHing in,
`git pull origin main`, then `docker compose up -d --build mcp api web`.

---

## Runbook 1 — Degraded API mode

**Trigger:** elevated 5xx rate or p95 latency alert (see `Docs/W6_DASHBOARDS_AND_ALERTS.md` §1–2),
or `/health` failing.

1. **Confirm scope.** Hit `GET /health` (liveness — process up) and `GET /health/ready`
   (readiness — DB connectivity, via `ShiftWork.Api/Services/DatabaseHealthCheck.cs`). If `/health`
   fails, the process is down or unresponsive — skip to step 4. If only `/health/ready` fails, the
   process is up but the database is unreachable — go to step 2.
2. **Database unreachable.** Check `DB_CONNECTION_STRING` target is reachable from the host
   (`Program.cs` throws at startup if this env var is unset, so a missing/wrong value would have
   already failed the whole deploy — this scenario is a runtime DB outage, not misconfiguration).
   Check the SQL Server instance's own status/logs. There's no read-replica or fallback DB
   configured — if the primary is down, the API is fully down for anything touching data (which is
   everything except `/health`).
3. **Elevated errors, DB is reachable.** Check application logs for the specific `LogError` calls
   (every controller wraps its body in try/catch and logs before returning 500 — see
   `BulletinsController`, `SafetyController`, etc.) to find which endpoint/exception is spiking.
   Common causes given this codebase: a bad migration left a schema mismatch, a null-reference in
   a service layer, or a downstream dependency (S3, push, weather API) throwing unhandled — check
   whether the failing service wraps external calls in try/catch (`WeatherService` is documented
   as non-blocking / returns null on failure; `AwsS3Service` logs and rethrows in most paths, which
   an unhandled exception in a controller not expecting it would turn into a 500).
4. **Process down / unresponsive.** SSH to the host, `docker compose ps` to check container
   status, `docker compose logs api --tail 200` for the crash reason, `docker compose restart api`.
   If it crash-loops, go to Runbook 4 (rollback) rather than repeatedly restarting.
5. **Mitigate user impact while investigating:** the Kiosk app's post-clockout interstitial already
   auto-advances after 5s on load failure, so clock-in/out itself keeps working even if bulletins/
   safety endpoints are degraded — prioritize investigating anything touching `POST /api/kiosk/*`
   or `POST /api/auth/login` over the v2 content endpoints, per the plan's prioritization rule
   ("protect clocking and payroll-adjacent workflows first").

## Runbook 2 — S3 outage / misconfiguration

**Trigger:** upload/download failures reported for documents, daily-report photos, or bulletin
attachments; `AwsS3Service` logging `AmazonS3Exception` errors.

1. **Identify the failure mode from logs** — `AwsS3Service` distinguishes:
   - Bucket not found + `AWS_S3_AUTO_CREATE` disabled → logs
     `"S3 bucket '{BucketName}' not found in region '{Region}' and auto-create disabled."`
     This is a config problem (wrong `AWS_S3_BUCKET_NAME` or wrong `AWS_REGION`), not an AWS outage
     — fix the env var, restart.
   - `AmazonS3Exception` on upload/download → could be a real AWS outage, a credentials/permission
     problem (IAM role expired or scoped wrong), or a bucket policy blocking the presigned URL's
     verb. Check the exception's `StatusCode`/`ErrorCode` in the log — 403 means permissions, 5xx
     means AWS-side.
   - Object not found (404) on GET → logged as a `LogWarning`, not an error — this is often a
     legitimately deleted/never-uploaded object, not an outage signal on its own.
2. **Confirm scope:** documents, daily-report media, and bulletin attachments all go through the
   same `IAwsS3Service` — an outage here affects all three uniformly. Employees can still clock in/
   out and read bulletin/safety text content; only file access is degraded.
3. **If it's an AWS-side outage:** check the AWS status page for the configured `AWS_REGION`.
   Nothing to do but wait and communicate — there's no secondary storage provider configured.
4. **If it's a presigned URL expiry complaint:** by design, GET and PUT URLs expire in 15 minutes
   (`GeneratePresignedGetUrl`/`GeneratePresignedPutUrl` in `DocumentService.cs`, and the daily
   report/bulletin upload paths use the same `IAwsS3Service`). A user hitting an expired link
   should simply re-request; this is not an incident.
5. **Communicate:** document/photo upload and viewing will be degraded/unavailable; bulletins,
   safety text, daily report data entry, and clocking are unaffected.

## Runbook 3 — Push notification provider outage

**Trigger:** `PushNotificationService` logging `LogError("Failed to send push notifications...")`
repeatedly, or employees reporting they aren't receiving bulletin/safety/schedule push alerts.

1. **Confirm it's the provider, not registration.** `LogWarning("No device tokens found for
   ...")` means the recipient(s) never registered a device token (a mobile app issue, not an
   outage) — don't treat this as an incident on its own. `LogError` with the Expo response
   status/body means the Expo Push API itself rejected or failed the batch — that's the real
   outage signal.
2. **Check `EXPO_PUSH_API_URL`** is still pointing at the correct endpoint and hasn't been
   inadvertently changed in the environment config.
3. **Check Expo's own status page** for the push service.
4. **Mitigate:** push is the *notification* layer only — the underlying data (bulletins, safety
   content, schedules) is still created and visible in-app; only the "someone gets pinged" part is
   degraded. Communicate to managers that time-sensitive bulletins/safety content may need a
   manual follow-up (call/text) until push recovers, per the "push notifications for all
   time-sensitive content" UX principle in `CLAUDE.md`.
5. **After recovery:** there is no current retry/backfill mechanism for missed push sends — anyone
   who should have been notified during the outage window will need the content surfaced to them
   some other way (it's still readable in-app; nothing is lost, only the alert).

## Runbook 4 — Emergency rollback

**Trigger:** a bad deploy is confirmed as the cause of an incident (crash loop, data corruption
risk, security regression) and forward-fixing isn't fast enough.

1. **Identify the last known-good commit on `main`** (the deploy workflow only triggers on pushes
   to `main`, so this is the branch that matters for rollback).
2. **Roll back application code:**
   ```bash
   ssh <deploy-user>@<deploy-host>
   cd <project-path>
   git log --oneline -10          # confirm the bad commit and its parent
   git reset --hard <last-good-sha>
   docker compose up -d --build mcp api web
   docker compose ps --filter 'status=running'   # confirm all 3 services report running
   ```
   This mirrors exactly what `.github/workflows/deploy.yml` does on a normal deploy, just pointed
   at an older commit instead of `HEAD`. Prefer this over `git revert` + re-push through CI if the
   incident is active — a manual rollback is faster than waiting on a new CI run, but **follow up
   with a proper `git revert` PR through the normal pipeline once the fire is out**, so `main` and
   the remote host don't permanently diverge.
3. **If the bad deploy included an EF Core migration:** check
   `ShiftWork.Api/Migrations/` for what the last migration touched before rolling back code. Rolling
   back application code does **not** roll back an already-applied migration. If the new migration
   is backward-compatible (additive: new nullable column, new table), the old code can usually run
   against the new schema safely — verify this before rolling back, don't assume it. If the
   migration was destructive (dropped/renamed a column the old code depends on), rolling back code
   alone will break — you need `dotnet ef database update <previous-migration-name>` run against
   production first (high-risk, do this deliberately, not as a reflex).
4. **Rollback for Mobile/Kiosk (Expo/EAS):** these aren't covered by `deploy.yml` (it explicitly
   ignores `ShiftWork.Mobile/**` path changes) — mobile releases go through EAS separately (project
   `531adbf1-53a0-48ca-9fc8-f65ae312365a`, per the W3 summary in
   `PROFESSIONAL_DAILY_USE_PLAN.md`). Roll back via EAS's own release management, not this repo's
   git history.
5. **Post-rollback:** confirm `/health` and `/health/ready` both report healthy, re-check the
   dashboards in `Docs/W6_DASHBOARDS_AND_ALERTS.md` for the metric that triggered the incident, and
   open the follow-up `git revert` PR.
