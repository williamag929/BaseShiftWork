# W4 Security Checklist — Content & Communication Subsystem

**Branch:** `feature/professional-w4-security` (from `develop`)
**Scope:** Bulletins, Daily Reports, Documents, Safety (the v2 content/communication modules)
**Plan reference:** `Docs/PROFESSIONAL_DAILY_USE_PLAN.md` — Week 4

## 1. Company-scoping audit

Reviewed every service method behind `BulletinsController`, `DailyReportsController`,
`DocumentsController`, and `SafetyController` for tenant isolation, and added
xUnit cross-tenant rejection tests for each (`ShiftWork.Api.Tests`).

| Endpoint group | Method | Scoped correctly? | Notes |
|---|---|---|---|
| Bulletins | `GetBulletinsAsync`, `GetUnreadAsync`, `GetByIdAsync`, `CreateAsync`, `ArchiveAsync` | ✅ | Already filtered by `CompanyId` |
| Bulletins | `MarkAsReadAsync` | 🐛 **Fixed** | `companyId` parameter was accepted but never checked — a caller could mark any bulletin GUID as read regardless of tenant. Added a `Bulletins.Any(CompanyId == companyId)` guard; now returns `false`/404 for cross-tenant IDs. |
| Bulletins | `UpdateAsync`, `GetReadsAsync` | ✅ | Already scoped; added explicit cross-tenant tests |
| Daily Reports | `GetReportsAsync`, `GetOrCreateAsync`, `UpdateAsync` | ✅ | Already filtered by `CompanyId` |
| Daily Reports | `AddMediaAsync` | 🐛 **Fixed** | `companyId` parameter was unused — media could be attached to any report GUID from any company. Added a report-ownership check; controller now returns 404 when it fails. |
| Daily Reports | `RemoveMediaAsync` | 🐛 **Fixed** | Same issue — `companyId` was unused. Added the same ownership check. |
| Documents | `GetDocumentsAsync`, `GetByIdAsync`, `InitiateUploadAsync`, `ConfirmUploadAsync`, `UpdateAsync`, `ArchiveAsync`, `GetReadLogsAsync` | ✅ | Already filtered by `CompanyId`; added missing cross-tenant tests for `GetByIdAsync`, `UpdateAsync`, `ArchiveAsync`, `GetReadLogsAsync` |
| Safety | `GetContentsAsync`, `GetByIdAsync`, `CreateAsync`, `UpdateAsync`, `ArchiveAsync`, `AcknowledgeAsync`, `GetPendingForPersonAsync` | ✅ | Already filtered by `CompanyId`; added missing cross-tenant tests for `GetByIdAsync`, `UpdateAsync`, `ArchiveAsync`, `GetAcknowledgmentStatusAsync` |

**Result:** 2 real cross-tenant write vulnerabilities found and fixed (Bulletin read-tracking,
report media). Both now have regression tests. 16 new cross-tenant tests added across the four
services; full suite is 92/92 passing (`ShiftWork.Api.Tests`).

## 2. Auth middleware validation

- Confirmed `Program.cs` registers two JWT schemes: the default (Firebase, for web/admin) and
  `"ApiJwt"` (issued by `POST /api/auth/login`, for mobile). Scheme selection is
  content/audience-based, matching `CLAUDE.md`'s documented auth model.
- All four v2 controllers are `[Authorize]` at the class level with per-action
  `[Authorize(Policy = "...")]` permission checks (e.g. `bulletins.read`, `safety.create`),
  consistent with `PermissionAuthorizationHandler`. No endpoint found bypassing policy checks.

## 3. S3 presigned URL audit

- `DocumentService.GeneratePresignedGetUrl` / `GeneratePresignedPutUrl`: both set
  `Expires = DateTime.UtcNow.AddMinutes(15)` and set the HTTP verb explicitly (`GET` / `PUT`),
  so a GET URL cannot be reused to overwrite the object. Matches spec.
- Raw S3 keys are never returned to clients — only presigned URLs (`DocumentService`,
  `DailyReportsController`).

## 4. Audit history review

`AuditInterceptor` resolves `CompanyId` via reflection and skips any entity type without a
`CompanyId` property. Four v2 child/log tables have no `CompanyId` column of their own:
`BulletinRead`, `SafetyAcknowledgment`, `DocumentReadLog`, `ReportMedia` — these were being
**silently skipped**, so read/acknowledgment/media-upload writes left no `AuditHistory` trail.

**Fix:** extended `AuditInterceptor` with a parent-lookup table
(`ChildEntityParentLookup`) that resolves `CompanyId` from the owning entity
(`Bulletin`, `SafetyContent`, `Document`, `LocationDailyReport`) via `DbContext.Find`
when the child entity itself has no `CompanyId`. Added `ShiftWork.Api.Tests/Audit/AuditInterceptorTests.cs`
(5 tests) proving each of the 4 child types now produces an `AuditHistory` row with the
correct `CompanyId`.

**Residual note (not fixed, low risk):** `DailyReportService.RemoveMediaAsync` calls
`_context.ReportMedia.Remove(...)` — a hard delete. `CLAUDE.md`'s "no hard deletes" rule is
scoped to *content* entities (which use a `Status = Archived` pattern); `ReportMedia` has no
status field and removal is now fully audited (captured as a "Deleted" `AuditHistory` entry
with a full property snapshot), so the change is traceable even though the row is gone. Flagging
for future consideration if report media needs to be recoverable after deletion.

## Signoff

| Area | Status |
|---|---|
| Company scoping | ✅ Pass (2 findings fixed, regression-tested) |
| Auth middleware | ✅ Pass |
| S3 presigned URLs | ✅ Pass |
| Audit history coverage | ✅ Pass (gap fixed, regression-tested) |
| High-severity findings open | **0** |

Week 4 security hardening sprint: **complete**, no unresolved high-severity findings.
