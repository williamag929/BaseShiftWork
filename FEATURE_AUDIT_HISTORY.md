# Feature Documentation: Audit History From Record Screens

## Overview
Add an audit history view accessible from the same screen where records are edited. Example: on the employee screen, add a History action button that opens changes for the employee, plus related shifts and schedules.

## Goals
- Make it easy to audit changes without leaving the current record screen.
- Show who changed what, when, and the before/after values.
- Cover employee data, shifts, and schedules history.

## Impact Summary
- Medium to high impact on API, database, and UI.
- Requires consistent audit data for all affected entities.

## Difficulty Level
- Overall difficulty: Medium
- Reasons:
  - Needs reliable audit trails across multiple entities.
  - Requires UI for timeline/history and filtering.

## Requirements
- From the employee screen, add a History action button.
- History view shows:
  - Employee profile changes
  - Shift changes for that employee
  - Schedule changes for that employee
- Include: actor, timestamp, field changes (before/after), and source (web/mobile/API).
- Provide filters by entity type and date range.

## Tasks (Step-by-Step)

### Phase 1 - Data Model and Audit Strategy
1. Define audit record schema:
   - entityType (Employee, Shift, Schedule)
   - entityId
   - companyId
   - changedBy (user id)
   - changedAt
   - changes (field, old, new)
   - source (web, mobile, api)
2. Decide storage:
   - New AuditLog table, or
   - Existing audit mechanism if present
3. Ensure audit records are written for create/update/delete actions.

### Phase 2 - API Endpoints
1. Add endpoint to fetch audit history:
   - GET /api/companies/{companyId}/audit
   - Query params: entityType, entityId, startDate, endDate
2. Add a focused endpoint for employee view:
   - GET /api/companies/{companyId}/employees/{employeeId}/audit
   - Returns employee + shifts + schedules changes

### Phase 3 - Web App (Angular)
1. Add a History button on employee detail screen.
2. Implement a timeline list with filters and pagination.
3. Show readable diff for changes (before/after).

### Phase 4 - Mobile App (React Native)
1. Add History action on employee screen.
2. Show a simple audit list with filters.
3. Ensure consistent formatting with web.

### Phase 5 - Security and Compliance
1. Restrict access to audit history by role (admin/manager).
2. Redact sensitive fields where needed (PII, secrets).
3. Log audit access if required by compliance.

### Phase 6 - QA and Release
1. Add tests that verify audit records are created on updates.
2. Add API tests for filters and pagination.
3. Add UI tests for the History button and timeline view.

## Acceptance Criteria
- Employee screen shows a History action button.
- History view displays changes for employee, shifts, and schedules.
- Audit entries include actor, timestamp, and before/after values.
- Filters work by entity type and date range.
- Access is restricted to authorized roles.

## Open Questions
- Which roles can view audit history (admin only vs manager)?
- Retention period for audit logs (e.g., 1 year, 3 years, forever)?
- Should we allow export of audit history (CSV/PDF)?
