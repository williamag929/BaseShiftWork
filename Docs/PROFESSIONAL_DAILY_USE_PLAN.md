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

### Week 1 - Baseline and Gap Lock
- Finalize gap checklist for each module.
- Confirm prioritized backlog and owners.
- Define release metrics and test matrix.

### Week 2 - Product Parity Sprint
- Complete WS1 API/Angular/Mobile/Kiosk parity items.
- Demo end-to-end flows.

### Week 3 - Core Test Sprint
- Implement WS2 critical API + client tests.
- Enable CI blocking for critical suites.

### Week 4 - Security Hardening Sprint
- Execute WS3 checklist and remediation.
- Verify tenancy and auth boundary tests.

### Week 5 - Observability and Runbooks
- Implement WS4 dashboards, alerts, runbooks.
- Perform failure simulation drills.

### Week 6 - Stabilization and Release Readiness
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
