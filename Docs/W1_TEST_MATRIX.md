# Week 1 Test Matrix and Release Metrics

> Branch: `feature/professional-w1-baseline`
> Source: `PROFESSIONAL_DAILY_USE_PLAN.md` — Success Criteria 2, 3, 4

---

## Release Metrics

| Metric | Target | Measurement |
|---|---|---|
| P1 open defects | 0 | Backlog review at end of each sprint |
| P2 open defects | ≤ 3 (all triaged) | Backlog review |
| API critical test pass rate | 100% | `dotnet test --filter Category=Critical` |
| Angular service spec pass rate | 100% | `ng test --include **/core/services/*.spec.ts` |
| Angular component spec pass rate | 100% | `ng test --include **/features/dashboard/**/*.spec.ts` |
| CI gate on PR | Enforced for API and Angular | GitHub Actions workflow |
| Core employee workflows unblocked | 6/6 | Manual smoke test checklist below |
| Structured log coverage (key actions) | 8/8 actions emit log entries | Manual log review |
| Security checklist pass | No high-severity findings | WS3 sign-off |

---

## Critical Employee Workflow Smoke Tests

These six workflows must pass end-to-end before each release candidate.

| # | Workflow | Surface(s) | Steps | Pass Criteria |
|---|---|---|---|---|
| SW-01 | Clock in/out | Kiosk | PIN verify → Clock In → work → Clock Out | ClockIn event recorded; ClockOut event recorded; ShiftEvent row in DB |
| SW-02 | Post-clockout interstitial ack | Kiosk | Clock Out → interstitial shows → acknowledge safety item | SafetyAcknowledgment row created; PersonId + SafetyContentId match |
| SW-03 | Bulletin read tracking | Mobile / Angular | Employee opens bulletin → mark read | BulletinRead row created; unread count decrements |
| SW-04 | Safety acknowledgment tracking | Mobile | Employee opens safety item → scroll to bottom → tap Acknowledge | SafetyAcknowledgment row created; pending count decrements |
| SW-05 | Daily report submit flow | Mobile | Supervisor opens daily report tab → fills notes → Submit | LocationDailyReport status = Submitted; manager sees Approve button |
| SW-06 | Document access/download | Mobile | Employee taps document → opens in viewer → logs read | DocumentReadLog row created; file opens without error |

---

## API Integration Test Matrix

Test project: `ShiftWork.Api.Tests/`

### Bulletins (BulletinServiceTests.cs)

| Test | Category | Assertion |
|---|---|---|
| CreateBulletin_ValidInput_ReturnsBulletinDto | Critical | Status 201; BulletinId populated |
| CreateBulletin_WrongCompany_ReturnsForbidden | Critical | 403 |
| GetBulletins_FilterByLocation_ReturnsFiltered | Critical | Only matching locationId returned |
| GetBulletins_FilterByStatus_ReturnsFiltered | Standard | Active/Archived filter respected |
| MarkRead_NewRead_CreatesReadRecord | Critical | BulletinRead row inserted; idempotent on repeat call |
| MarkRead_AlreadyRead_Returns200NoDouble | Critical | No duplicate BulletinRead row |
| DeleteBulletin_ValidManager_SoftDeletes | Standard | IsDeleted = true; excluded from list |
| DeleteBulletin_NonManager_ReturnsForbidden | Critical | 403 |

### Daily Reports (DailyReportServiceTests.cs)

| Test | Category | Assertion |
|---|---|---|
| GetOrCreate_NewDate_CreatesReport | Critical | Status 200; report id in response |
| GetOrCreate_ExistingDate_ReturnsExisting | Critical | Idempotent — same id on repeat call |
| SubmitReport_Draft_StatusBecomesSubmitted | Critical | Status = Submitted |
| SubmitReport_AlreadySubmitted_Returns409 | Standard | 409 Conflict |
| ApproveReport_Submitted_StatusBecomesApproved | Critical | Status = Approved |
| ApproveReport_WithoutPermission_Returns403 | Critical | 403 |
| AddMedia_ValidReport_MediaRowCreated | Standard | ReportMedia row inserted |

### Documents (DocumentServiceTests.cs)

| Test | Category | Assertion |
|---|---|---|
| InitiateUpload_ValidInput_ReturnsPresignedUrl | Critical | PresignedUrl non-empty; Document row pending |
| ConfirmUpload_ValidDocumentId_StatusActive | Critical | Document.Status = Active |
| GetDocuments_FilterByType_ReturnsFiltered | Critical | Correct type returned |
| GetDocumentById_ValidId_ReturnsDto | Critical | Correct title, url, type |
| LogDocumentRead_NewAccess_CreatesReadLog | Critical | DocumentReadLog row inserted |
| LogDocumentRead_Repeat_IdempotentNoDouble | Critical | No duplicate log row |
| ArchiveDocument_ValidManager_SoftArchives | Standard | IsArchived = true |
| ArchiveDocument_WrongCompany_Returns403 | Critical | 403 |

### Safety (SafetyServiceTests.cs)

| Test | Category | Assertion |
|---|---|---|
| CreateSafetyContent_ValidInput_ReturnsDto | Critical | Status 201; SafetyContentId populated |
| GetContents_FilterByLocation_ReturnsFiltered | Critical | Only matching locationId returned |
| GetContents_FilterByStatus_ReturnsActive | Standard | Archived excluded |
| Acknowledge_NewAck_CreatesRecord | Critical | SafetyAcknowledgment row inserted |
| Acknowledge_AlreadyAcked_Returns200NoDouble | Critical | Idempotent — no duplicate row |
| GetComplianceRoster_ReturnsAckStatus | Standard | All persons listed with acked/pending flag |
| DeleteContent_ValidManager_SoftDeletes | Standard | IsDeleted = true |
| DeleteContent_WithoutPermission_Returns403 | Critical | 403 |

---

## Angular Service Spec Matrix

Test runner: Karma / Jasmine (`ng test`)

### bulletin.service.spec.ts

| Test | Assertion |
|---|---|
| getBulletins — success | Calls `GET /companies/{id}/bulletins`; returns mapped array |
| getBulletins — HTTP error | Catches error; re-throws with message |
| markRead — success | Calls `POST /bulletins/{id}/read`; returns void |
| createBulletin — success | Calls `POST /companies/{id}/bulletins`; returns DTO |

### daily-report.service.spec.ts

| Test | Assertion |
|---|---|
| getOrCreate — success | Calls `GET /locations/{id}/daily-reports`; returns DTO |
| submitReport — success | Calls `PUT /daily-reports/{id}/submit`; returns updated DTO |
| approveReport — success | Calls `PUT /daily-reports/{id}/approve`; returns updated DTO |

### document.service.spec.ts

| Test | Assertion |
|---|---|
| getDocuments — success | Calls `GET /companies/{id}/documents`; returns array |
| initiateUpload — success | Calls `POST /documents/initiate`; returns presigned URL |
| logRead — success | Calls `POST /documents/{id}/read`; returns void |

### safety.service.spec.ts

| Test | Assertion |
|---|---|
| getContents — success | Calls `GET /companies/{id}/safety`; returns array |
| acknowledge — success | Calls `POST /safety/{id}/acknowledge`; returns void |
| getComplianceRoster — success | Calls `GET /safety/{id}/compliance`; returns roster |

---

## Angular Component Spec Matrix (smoke level)

### bulletins.component.spec.ts

| Test | Assertion |
|---|---|
| creates component | ComponentFixture created without error |
| shows loading spinner on init | `loading = true` → spinner in DOM |
| shows empty state when list empty | `bulletins = []` → `.empty-state` in DOM |
| shows error banner on load failure | Service rejects → `.error-banner` in DOM |

Same pattern applied to: `daily-reports.component.spec.ts`, `documents.component.spec.ts`, `safety.component.spec.ts`.

---

## CI Gate Definition

File: `.github/workflows/ci.yml` (to be created in WS2)

| Gate | Trigger | Command | Fail behavior |
|---|---|---|---|
| API tests | PR to main / feature branches | `dotnet test --filter Category=Critical` | Block merge |
| Angular tests | PR to main / feature branches | `ng test --watch=false --browsers=ChromeHeadless` | Block merge |
| API build | PR to main | `dotnet build --no-restore` | Block merge |
| Angular build | PR to main | `ng build --configuration=production` | Block merge |
| Mobile type check | PR to main | `npx tsc --noEmit` (ShiftWork.Mobile) | Block merge |
| Kiosk type check | PR to main | `npx tsc --noEmit` (ShiftWork.Kiosk) | Block merge |

---

## Release Gate Checklist

- [ ] All 6 critical employee workflow smoke tests pass (SW-01 through SW-06)
- [ ] All Critical-category API tests pass (`dotnet test --filter Category=Critical`)
- [ ] All Angular service specs pass
- [ ] All Angular component smoke specs pass
- [ ] CI pipeline blocks failing PRs
- [ ] Zero P1 open defects in backlog
- [ ] P2 defects ≤ 3 and all triaged
- [ ] Frontend permission gating verified for manager vs employee roles (B-01, B-02)
- [ ] Structured log entries present for all 8 key actions (B-09)
- [ ] WS3 security checklist signed off (tenant scoping, S3 policy, audit history)
- [ ] Rollback runbook drafted and validated
