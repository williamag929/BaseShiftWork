# Professional Daily-Use Plan (Balanced Across Modules)

## Goal
Move ShiftWork from feature-complete to professional, reliable daily use across API, Angular, Mobile, Kiosk, and operational tooling.

## Scope
- ShiftWork.Api
- ShiftWork.Angular
- ShiftWork.Mobile
- ShiftWork.Kiosk
- Cross-cutting DevOps, QA, security, and observability

## Success Criteria
1. Critical employee workflows are stable end-to-end:
   - clock in/out
   - kiosk post-clockout interstitial acknowledgments
   - bulletin read tracking
   - safety acknowledgment tracking
   - daily report submit flow
   - document access/download flow
2. No open P1 defects and no unresolved security blockers.
3. Baseline automated tests exist and pass in CI for all touched modules.
4. Production telemetry and alerting are active for core APIs and mobile/kiosk failures.
5. Deployment and rollback runbooks are validated.

## Current Snapshot (High Level)
- API: Core v2 content/communication modules are implemented.
- Angular: Dashboard routes and nav entries exist for bulletins, daily reports, documents, and safety.
- Mobile: v2 screens/services exist but not all are fully exposed in tab UX for daily discoverability.
- Kiosk: Post-clockout interstitial exists for urgent bulletins and safety acknowledgments.
- Testing: API v2 module coverage appears limited and should be expanded.

## Workstreams

### WS1 - Product Parity and Discoverability
Objective: Ensure users can reliably find and use v2 features on every surface.

Tasks:
- API
  - Confirm consistent pagination/filtering for bulletins, documents, safety, daily reports.
  - Validate idempotent read/ack endpoints.
- Angular
  - Validate loading/empty/error states in all 4 v2 modules.
  - Verify role/permission gating for manager vs employee views.
- Mobile
  - Expose v2 feature entry points clearly (tabs or dashboard shortcuts).
  - Add unread/pending indicators for bulletins and safety.
  - Ensure documents are discoverable from primary navigation.
- Kiosk
  - Verify interstitial ordering, limits, and timeout behavior.
  - Ensure non-blocking failure handling still records telemetry.

Done when:
- Same core v2 actions are accessible and consistent across Angular, Mobile, and Kiosk.

### WS2 - Reliability and Quality Gates
Objective: Add enough automated safety nets for confident daily operation.

Tasks:
- API tests
  - Add integration tests for bulletins, safety acknowledgment, daily reports, and documents.
  - Add permission tests for create/read/archive/ack flows.
- Angular tests
  - Add service and feature-level specs for v2 modules.
- Mobile/Kiosk tests
  - Add critical path tests for read/ack/submit flows.
  - Add error-path tests for offline/network failure states.
- CI quality gates
  - Enforce test run on PR for touched module(s).
  - Add minimal coverage threshold for newly added tests.

Done when:
- CI blocks merges on failing critical tests.

### WS3 - Security and Compliance Hardening
Objective: Make auth, tenancy boundaries, and data access production-safe.

Tasks:
- Verify company scoping across all v2 endpoints.
- Validate auth token handling for web/admin and mobile paths.
- Confirm S3 presigned URL policy and expiry behavior.
- Review audit history capture for v2 write operations.
- Add security checklist for release signoff.

Done when:
- Security checklist passes with no high-severity findings.

### WS4 - Observability and Operations
Objective: Make issues detectable and recoverable quickly.

Tasks:
- Add structured logs for key v2 actions:
  - bulletin create/read
  - safety assign/ack
  - report submit
  - document open/download
- Add dashboards and alerts:
  - API error rate, p95 latency, auth failures
  - push notification failures
  - kiosk interstitial failures
- Prepare runbooks:
  - degraded API mode
  - S3 outage
  - push provider outage
  - emergency rollback

Done when:
- On-call can detect and triage failures within minutes using dashboards + runbooks.

## Sequenced Execution Plan (6 Weeks)

### Week 1 - Baseline and Gap Lock ✅ COMPLETE
Branch: `feature/professional-w1-baseline`
- `Docs/W1_GAP_CHECKLIST.md` — 8 prioritized gaps (G1–G8)
- `Docs/W1_PRIORITIZED_BACKLOG.md` — 14 backlog items B-01–B-14
- `Docs/W1_TEST_MATRIX.md` — release metrics, smoke tests, CI gate definitions

### Week 2 - Product Parity Sprint ✅ COMPLETE
Branch: `feature/professional-w2-parity` (commit `acae1f9`)
- API pagination on all 4 list endpoints (`PagedResultDto<T>`)
- Angular error banners + retry() on all 4 v2 components
- Angular `mat-paginator` server-side pagination on bulletins, documents, safety
- Angular permission gating (`canCreate`/`canArchive` via `PermissionService`)
- Mobile error states on all 4 v2 screens; documents tab added to bottom nav
- Kiosk interstitial error fallback (5s auto-advance on load failure)
- API structured logging on all 4 v2 services

### Week 3 - Core Test Sprint ✅ COMPLETE
Branch: `feature/professional-w3-tests` (commits `7d02952`–`89a8a57`)
- API tests: 71 passing across BulletinService, SafetyService, DailyReportService, DocumentService
- Angular specs: bulletin, safety, documents, daily-reports components + service specs
- Mobile Jest: 31 tests across bulletin, safety, document, daily-report services
- Kiosk Jest: 8 tests for interstitial service (getPostClockout, markBulletinRead, acknowledgeSafety)
- CI gate: `pr-tests.yml` with 4 jobs — api-tests, angular-typecheck, mobile-tests, kiosk-tests
- `TestHelpers/FakePush` no-op wrapper for push in all API tests
- **Also completed (alongside W3):** push + email notifications wired to schedule/shift publish; mobile device token lifecycle (register → store → remove on sign-out); EAS project linked (`531adbf1-53a0-48ca-9fc8-f65ae312365a`)

### Week 4 - Security Hardening Sprint ⬜ NOT STARTED
Branch: `feature/professional-w4-security` (to be created from W3)
- Company scoping audit — cross-tenant rejection tests on all v2 endpoints
- Auth middleware validation — Firebase JWT (web) vs. API JWT (mobile) applied correctly
- S3 presigned URL audit — expiry (15 min), verb enforcement, bucket policy
- Audit history review — confirm `AuditInterceptor` covers all v2 writes
- `Docs/W4_SECURITY_CHECKLIST.md` — per-endpoint findings + signoff

### Week 5 - Observability and Runbooks ⬜ NOT STARTED
- Dashboards and alerts: API error rate, p95 latency, auth failures, push failures, kiosk failures
- Runbooks: degraded API, S3 outage, push provider outage, emergency rollback
- Failure simulation drills

### Week 6 - Stabilization and Release Readiness ⬜ NOT STARTED
- Bug bash across all modules.
- Performance smoke tests.
- Final go/no-go with measurable acceptance checklist.

## Prioritization Rules
1. Protect clocking and payroll-adjacent workflows first.
2. Prefer fixes that improve cross-surface consistency.
3. No new feature expansion until WS1 and WS2 are green.
4. Any P1/P2 bug found during rollout becomes immediate top priority.

## Risk Register
1. Risk: Partial parity creates user confusion across web/mobile/kiosk.
   - Mitigation: enforce WS1 done criteria before release.
2. Risk: Hidden regressions in v2 flows.
   - Mitigation: WS2 integration tests + CI gates.
3. Risk: Production incidents without visibility.
   - Mitigation: WS4 dashboards and alerts before launch.
4. Risk: Auth/tenant boundary regressions.
   - Mitigation: WS3 explicit tenancy/auth validation tests.

## Release Gate Checklist
- [ ] All success criteria met.
- [ ] No open P1 and no untriaged P2 defects.
- [ ] API + Angular + Mobile + Kiosk critical tests passing in CI.
- [ ] Security checklist signed off.
- [ ] Dashboards and alerts active.
- [ ] Rollback runbook tested.

## Ownership Template
- API Lead:
- Angular Lead:
- Mobile Lead:
- Kiosk Lead:
- QA Lead:
- DevOps Lead:
- Release Manager:

## Reporting Cadence
- Daily: blocker + risk update.
- Twice weekly: cross-module sync for parity + regression status.
- Weekly: release-readiness scorecard update.
