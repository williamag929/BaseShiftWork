# Feature Documentation: Registration, Company Setup, and Sandbox Data

## Overview
This feature adds a guided registration and onboarding flow for new customers, creates a company with default settings, seeds a sandbox dataset (areas/locations/employees), and supports upgrades from Free to Pro. It aims to reduce time-to-value while keeping production data clean and user-controlled.

## Impact Summary
- High impact on authentication, billing, onboarding UX, and core data model.
- Requires coordinated changes across API, web app, mobile, and database.
- Introduces compliance and security considerations (PII, billing, email verification).

## Difficulty Level
- Overall difficulty: High
- Reasons:
  - Multiple cross-cutting concerns (auth, billing, onboarding data, entitlements).
  - Requires safe data seeding and cleanup without corrupting production records.
  - Needs reliable role/plan enforcement throughout the app.

## Goals
- Allow new customers to register with basic user + company data.
- Automatically create a company, default settings, and sandbox data (areas/locations/employees).
- Allow users to hide or remove sandbox data when moving to production.
- Allow Free -> Pro upgrade with entitlement changes and billing.

## Assumptions
- API uses Firebase JWT for authentication.
- Company-scoped data uses /api/companies/{companyId}/... routes.
- Billing provider is Stripe.

## Risks & Mitigations
- Risk: Sandbox data mixing with production data.
  - Mitigation: Tag seeded data with a "isSandbox" flag and gate visibility.
- Risk: Incomplete cleanup of sandbox data.
  - Mitigation: Provide a single "reset sandbox" action that removes only sandbox-tagged records.
- Risk: Entitlement mismatch (Free vs Pro).
  - Mitigation: Centralize plan checks in API service layer.

## Tasks (Step-by-Step)

### Phase 1 - Requirements and Data Model
1. Confirm plan limits (Free employee cap, Pro features, trial rules).
2. Define required registration fields (user + company).
3. Add schema changes:
   - Add plan/tier to Company.
   - Add isSandbox flag to seedable entities (Area, Location, Employee, etc.).
   - Add onboarding status to Company or User.
4. Define default settings and sandbox seed templates.

### Phase 2 - API Endpoints
1. Create registration endpoint:
   - POST /api/auth/register
   - Accepts user + company data.
   - Creates user, company, default settings, and sandbox data.
2. Add sandbox management endpoints:
   - POST /api/companies/{companyId}/sandbox/hide
   - POST /api/companies/{companyId}/sandbox/reset
   - POST /api/companies/{companyId}/sandbox/delete
3. Add plan upgrade endpoint:
   - POST /api/companies/{companyId}/plan/upgrade
   - Integrates billing and updates entitlements.

### Phase 3 - Web App (Angular)
1. Registration UI:
   - Step 1: user data
   - Step 2: company data
   - Step 3: confirm + email verification
2. Onboarding UI:
   - Show sandbox data and explain it.
   - Provide actions: hide, reset, delete.
3. Upgrade UI:
   - Show Free vs Pro comparison.
   - Provide billing flow and confirmation.

### Phase 4 - Mobile App (React Native)
1. Add registration screens that match web flow.
2. Show onboarding sandbox prompt.
3. Provide upgrade screen or link to web billing.

### Phase 5 - Security and Compliance
1. Enforce Firebase auth for all new endpoints.
2. Ensure PII is encrypted at rest (if required).
3. Verify email on registration before onboarding completion.
4. Validate PCI compliance for payment flow.

### Phase 6 - Analytics and Monitoring
1. Track signup funnel events (start, verified, onboarded).
2. Track sandbox actions (hide/reset/delete).
3. Track upgrades (start, success, failure).

### Phase 7 - QA and Release
1. Add integration tests for registration and sandbox flows.
2. Add unit tests for plan enforcement.
3. Add rollback strategy for failed billing or partial onboarding.

## Acceptance Criteria
- New users can register with basic user and company data.
- Company and default settings are created automatically.
- Sandbox data appears on first login and is clearly labeled.
- Users can hide or remove sandbox data without affecting real data.
- Free plan limitations are enforced across API and UI.
- Users can upgrade to Pro and unlock features immediately.

## Decisions
- Sandbox data includes 2 employees, 1 area, 1 location, plus default settings to avoid first-run errors.
- Email verification is required before the first login via code or link confirmation.
- Sandbox data is not removed automatically; users can hide individual records at any time or remove sandbox data in settings after upgrading to Pro.
