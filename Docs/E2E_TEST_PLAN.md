# Loqzen End-to-End Test Plan

Manual end-to-end test plan covering the four Loqzen surfaces: **API** (`ShiftWork.Api`), **Angular web admin** (`ShiftWork.Angular`), **Mobile employee app** (`ShiftWork.Mobile`) and **iPad Kiosk** (`ShiftWork.Kiosk`). Every case is built on routes and endpoints that exist in the code today (file references are given so a tester or agent can check behaviour against source).

Run it top to bottom: each section produces the data the next one needs (company → location/area → employee → shift → punches → timesheet → integrations → billing).

## How to use this plan

- Copy the result tables into a dated run log (or fill them in a PR comment) and mark each row **PASS / FAIL / BLOCKED / N/A**. Put the bug link or a short note in *Notes*.
- A case is **PASS** only when every listed expected result is observed.
- **P0** cases must all pass before launch. **P1** cases may ship with a known-issue note.
- Use a **fresh test company** per run; never run against a real customer tenant.

## Environment and test data

| Item | Value for this run |
|---|---|
| API base URL | `[[API_URL]]` (e.g. staging) |
| Web admin URL | `[[WEB_URL]]` (invite links default to `https://app.loqzen.com/accept-invite`) |
| Mobile build | Expo dev client / EAS preview build `[[BUILD]]` on one Android + one iOS phone |
| Kiosk build | EAS preview build on an iPad `[[BUILD]]` |
| Stripe | **Test mode** keys + `stripe listen --forward-to [[API_URL]]/api/stripe/webhook` |
| Procore | Procore **sandbox** company + OAuth app credentials |
| Email | A real inbox you control (invites and password resets are sent via SMTP) |

Test accounts to prepare:

| Role | Account | Notes |
|---|---|---|
| Platform admin | `[[ADMIN_EMAIL]]` | Has `companies.create` permission (used in 1.x) |
| Company admin / manager | `qa-admin+<run>@[[DOMAIN]]` | Firebase login on web |
| Employee A | `qa-emp-a+<run>@[[DOMAIN]]` | Uses mobile app |
| Employee B | `qa-emp-b+<run>@[[DOMAIN]]` | Uses kiosk with PIN only |
| Second company admin | `qa-other+<run>@[[DOMAIN]]` | For tenant-isolation checks (section 11) |

## Known blockers found while writing this plan

These were found by reading the code; confirm them in the first run and decide before launch.

1. **Self-serve company signup is disabled in the API.** `POST /api/auth/register` (`AuthController.cs`) returns **403 "Self-registration is disabled"**; the original logic is commented out. The Angular `/register` wizard (`registration.service.ts`) and mobile `(auth)/register.tsx` still call it, so case 1.1 is expected to FAIL today. Decide: re-enable self-serve signup (needed for the flat-fee self-serve model) or remove/hide the signup UI and create companies via the admin path (case 1.2).
2. **`POST /api/auth/verify-pin` is not scoped by company.** It looks up the person by `PersonId` only and does not check `CompanyId`. Cover it in section 11 and in loqzen-daily task 10 (API integration tests).
3. **Mobile onboarding still shows "ShiftWork".** `ShiftWork.Mobile/app/(auth)/onboarding.tsx` passes `appName: 'ShiftWork'` to the title string. Should be Loqzen (user-visible).

---

## 1. Company signup and onboarding (Web + API)

Code: Angular `features/registration` (3-step wizard → `/register/verify`), `features/onboarding`; API `AuthController.Register`, `CompanyController` (`POST /api/companies`, `PATCH /api/companies/{companyId}/onboarding-status`), `SandboxController`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 1.1 | P0 | Web, API | 1. Open `[[WEB_URL]]/register`.<br>2. Complete the 3 steps (company name, email, phone, time zone, admin user).<br>3. Submit. | Company created on Free plan with a 14-day trial (`PlanCatalog.TrialLength`); redirected to `/register/verify`. **Today: expect 403 — see blocker 1.** | | |
| 1.2 | P0 | Web, API | 1. Sign in as platform admin.<br>2. Admin → `company/new` (or `POST /api/companies`).<br>3. Create "QA Co <run>" with the company admin email. | 201 Created; company appears in company list and in `GET /api/companies/my` for its admin. | | |
| 1.3 | P0 | Web | 1. Open the verification email link.<br>2. Complete `/register/verify`. | `onboarding-status` becomes `Verified`; app navigates to `/onboarding`. | | |
| 1.4 | P1 | Web, API | On `/onboarding`, check the sample-data card. | Shows "Your account includes sample data" with person/area/location counts from `GET .../sandbox/status`; "You're on the Free plan" shown. | | |
| 1.5 | P1 | Web, API | Click **Hide demo data**, then **Reset to defaults**, then **Remove permanently**. | Each shows its success message; after remove, counts are 0 and sample people/locations disappear from lists. Remove is blocked on Free if `sandbox.delete` is a Starter+ feature (expected 403 on Free). | | |
| 1.6 | P0 | Web | Click **Go to dashboard**. | Lands on `/dashboard`; `onboarding_company_id` cleared from session storage. | | |
| 1.7 | P1 | API | Call `PATCH /api/companies/{id}/onboarding-status` with `{"status":"Bogus"}`. | 400 "Status must be one of: Pending, Verified, Complete". | | |

## 2. Locations and areas (Web + API)

Code: Angular `dashboard/locations`, `dashboard/areas`; API `LocationsController`, `AreasController`, `CompanySettingsController` (geofence radius, default 100 m).

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 2.1 | P0 | Web | Dashboard → Locations → add "QA Site" with a real street address and lat/long. | Location saved; appears in list and in `GET /api/kiosk/{companyId}/locations`. | | |
| 2.2 | P1 | Web | Edit the location (name, address). | Changes persist after reload; an `AuditHistory` row is created. | | |
| 2.3 | P0 | Web | Dashboard → Areas → add "Lobby" under QA Site. | Area saved and linked to the location. | | |
| 2.4 | P1 | Web | Settings → set geofence radius to 150 m. | `GET /api/companies/{id}/settings` returns `geoFenceRadius: 150`; mobile picks it up on next launch. | | |
| 2.5 | P2 | Web | Locations → regenerate NFC tag for QA Site. | New tag key returned; old tag link no longer punches (see 6.7). | | |
| 2.6 | P1 | Web | Try to delete a location that has schedules. | Either blocked with a clear message or soft-deleted; no orphaned shifts in schedule views. | | |

## 3. Invite employee (Web + API + email)

Code: Angular `dashboard/people`; API `PeopleController` (`POST /people`, `POST /people/{personId}/send-invite`, `GET /people/{personId}/invite-status`). Invite URL: `{InviteUrl ?? https://app.loqzen.com/accept-invite}?token&companyId&personId&email&name`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 3.1 | P0 | Web | People → add Employee A (name, email, phone, role Employee, PIN 4 digits). | Person created with status Active; PIN stored hashed (never returned by API). | | |
| 3.2 | P0 | Web, API | Click **Send invite** for Employee A. | 200; invite email arrives with Loqzen branding (subject/body/footer say Loqzen, not JobLogSmart). | | |
| 3.3 | P0 | Email | Inspect the button link. | Points to `app.loqzen.com/accept-invite` (or the configured URL) with all 5 query params. | | |
| 3.4 | P1 | Web | Check invite status in People. | Shows "Pending"/"Invited" until accepted (`invite-status`). | | |
| 3.5 | P1 | Web | Resend invite. | New email; the previous token no longer works (7.4). | | |
| 3.6 | P1 | Web | Add Employee B with PIN only, no invite. | Person usable at kiosk without an app account. | | |
| 3.7 | P0 | Web, API | On Free plan, add employees until the cap (5) is exceeded. | 6th active employee is blocked with an upgrade prompt (`PlanCatalog.EmployeeCap`). Feeds section 10. | | |

## 4. Accept invite on mobile (Mobile + API)

Code: Mobile `app/(auth)/accept-invite.tsx` (reads `token, companyId, personId, email, name`, then `router.replace('/(auth)/company-select')`), deep-link scheme `loqzen://`; API `POST /api/auth/accept-invite` (password ≥ 6 chars, email must match invite, swaps `invite_` UID for `api_` UID, syncs roles).

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 4.1 | P0 | Mobile | On a phone with the app installed, tap the invite link from 3.2. | App opens on Accept Invite with "Welcome, <name>" and email pre-filled. (If it opens the browser instead, check the deep link / universal link setup.) | | |
| 4.2 | P0 | Mobile, API | Enter a password (≥ 6 chars), confirm, submit. | 200; app goes to Company Select, then to the tabs (Dashboard). | | |
| 4.3 | P1 | Mobile | Submit with a 5-char password. | Inline validation error; no API call (zod schema) or API 400. | | |
| 4.4 | P0 | API | Re-use the same invite link after accepting (or after a resend in 3.5). | 404 "Invalid or expired invite token." | | |
| 4.5 | P1 | API | Call accept-invite with a valid token but a different email. | 400 "Email address does not match the invite." | | |
| 4.6 | P0 | Mobile | Log out; log in with email + new password (`(auth)/login.tsx`). | Login succeeds; biometric option offered if the device supports it. | | |
| 4.7 | P1 | Mobile | First launch after login. | Onboarding screen title says **Loqzen** (today says ShiftWork — blocker 3); push permission prompt appears and device token registers (`DeviceTokensController`). | | |
| 4.8 | P1 | Web | Open the invite link on a desktop browser. | Web `/accept-invite` page works as a fallback for employees without the app. | | |

## 5. Schedule a shift (Web → Mobile)

Code: Angular `dashboard/schedules` (schedule grid); API `SchedulesController` (`POST`, `generate`, `assignments`, `void`), `ScheduleShiftsController`, `PeopleController unpublished-schedules`; Mobile tabs `schedule.tsx`, `weekly-schedule.tsx`, `schedule-grid.tsx`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 5.1 | P0 | Web | Schedules → create a shift today for Employee A at QA Site / Lobby, starting in 15 min, 2 h long. | Shift shows on the grid in the company time zone. | | |
| 5.2 | P0 | Web | Create a shift for Employee B at the same site. | Both shifts visible; no overlap warnings. | | |
| 5.3 | P0 | Web, Mobile | Publish the schedule. | Employee A gets a push notification; shift appears in the mobile Schedule tab with correct local time. | | |
| 5.4 | P1 | Web | Use **generate** for next week from a template/pattern. | Shifts generated for the right days; nothing created for inactive people. | | |
| 5.5 | P1 | Web | Edit the shift time; then void a different schedule. | Mobile reflects the change after refresh; voided schedule disappears for the employee. | | |
| 5.6 | P1 | Web | Assign an overlapping second shift to Employee A. | Conflict is flagged or blocked. | | |
| 5.7 | P2 | Web | Open replacement candidates for a shift. | Lists only same-company, available employees. | | |
| 5.8 | P1 | Web, Mobile | Change device time zone on the phone. | Shift times still display in the company/location time zone consistently (UTC refactor, see `Docs/UTC_DATE_REFACTOR_PLAN.md`). | | |

## 6. Clock in / out on mobile (Mobile + API)

Code: Mobile tab `clock.tsx`, `services/shift-event.service.ts`, `services/nfc-punch.service.ts`, `app/t/[tagKey].tsx`, offline cache `services/db.ts`; API `ShiftEventsController` (`POST /api/companies/{companyId}/shiftevents`, `PATCH .../{eventLogId}/review-geofence`), `NfcPunchController`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 6.1 | P0 | Mobile | Standing at QA Site, open Clock tab and tap **Clock in**. | Location permission requested once; ClockIn event created with GPS; tab shows running timer. | | |
| 6.2 | P0 | Web | Open Dashboard → Clock Shift (`clock-shift`). | Employee A shows as clocked in at QA Site with the right time. | | |
| 6.3 | P0 | Mobile | Tap **Clock out** after a few minutes. | ClockOut event created; timer stops; duration correct. | | |
| 6.4 | P0 | Mobile, Web | Clock in from > 150 m away from QA Site. | Punch is accepted but flagged outside geofence (or blocked, per company setting); manager can review it (`review-geofence`). | | |
| 6.5 | P1 | Mobile | Deny location permission and try to clock in. | Clear message explaining why location is needed; no crash. | | |
| 6.6 | P1 | Mobile | Turn on airplane mode, clock in, wait, turn network back on. | Punch queued locally and synced once online with the original tap time; no duplicate event. | | |
| 6.7 | P2 | Mobile | Tap the QA Site NFC tag (or open `loqzen://t/<tagKey>`). | NFC punch creates ClockIn/ClockOut; an old tag key (after 2.5) is rejected. | | |
| 6.8 | P1 | Mobile | Tap Clock in twice quickly. | Only one ClockIn event is stored. | | |

## 7. Clock in / out on the iPad kiosk with PIN (Kiosk + API)

Code: Kiosk `app/(setup)/index.tsx` (admin email or company ID → choose location → activate), `app/(kiosk)/index.tsx` → `pin.tsx` → `questions.tsx` → `clock.tsx` → `success.tsx` / `interstitial.tsx`, `app/(admin)`; API `KioskController` (`/api/kiosk/{companyId}/employees|config|locations|questions|clock|post-clockout|verify-admin-password`), `AuthController verify-pin`. `KioskClockRequest` supports `EventLogId` (idempotency), `EventDate` (≤ 7 days old, not future) and `Pin` (enforced when `KioskSettings:EnforcePinOnClock` is on).

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 7.1 | P0 | Kiosk | Fresh install → Setup → sign in with the company admin email → choose QA Site → activate. | Kiosk opens the employee list for QA Site; setup survives app restart. | | |
| 7.2 | P1 | Kiosk | Repeat setup using the company ID path instead of email. | Same result; invalid ID shows "connect failed" message. | | |
| 7.3 | P0 | Kiosk | Tap Employee B → enter correct PIN. | PIN accepted; kiosk questions shown if configured; ClockIn recorded; success screen auto-returns to the list. | | |
| 7.4 | P0 | Kiosk | Tap Employee B → enter a wrong PIN. | "Incorrect PIN" message, PIN pad clears, no event created. | | |
| 7.5 | P0 | Kiosk, Web | Clock Employee B out. | ClockOut recorded; web Clock Shift view updates. Post-clockout interstitial shows any urgent bulletin / pending safety item (max 3) and can be acknowledged. | | |
| 7.6 | P1 | Kiosk | With photo capture enabled, clock in. | Photo taken and uploaded via presigned S3 URL; visible on the event in web. | | |
| 7.7 | P1 | Kiosk | Turn Wi-Fi off, punch, turn it back on. | Punch queued and sent with original `EventDate` and same `EventLogId`; exactly one event server-side. | | |
| 7.8 | P1 | API | Send `POST /api/kiosk/{companyId}/clock` with `EventType: "Break"`. | 400 "EventType must be 'ClockIn' or 'ClockOut'." | | |
| 7.9 | P1 | API | With `EnforcePinOnClock` on, POST clock without `Pin`. | Rejected (`KioskPunchRejectedException` status code), no event created. | | |
| 7.10 | P1 | Kiosk | Open admin mode and enter the admin password. | `verify-admin-password` gates admin screen; wrong password denied. | | |
| 7.11 | P2 | Kiosk | Leave the kiosk idle mid-flow. | Times out back to the employee list; no session data kept (kiosk is stateless). | | |
| 7.12 | P1 | Kiosk | Switch kiosk language to Spanish. | All kiosk strings in Spanish (`GET /api/kiosk/{companyId}/language`). | | |

## 8. Timesheet approval and daily report (Web + Mobile + API)

Code: API `ScheduleShiftSummariesController` (`GET`), `ShiftSummaryApprovalsController` (`PUT`, policy `shift-summary-approvals.update`), `ShiftEventsController PUT`, `DailyReportsController` (`/api/companies/{companyId}/locations/{locationId}/daily-reports`, media upload); Angular `dashboard/daily-reports`, `dashboard/analytics`; Mobile tab `daily-report.tsx`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 8.1 | P0 | Web | Open the shift summary / timesheet for today. | Employee A (mobile) and Employee B (kiosk) rows show scheduled vs actual hours matching the punches from 6 and 7. | | |
| 8.2 | P0 | Web | Approve both rows. | Status changes to Approved; approval is recorded with approver and time. | | |
| 8.3 | P1 | Web | Correct a punch time on a row, then re-check totals. | Totals recalculate; edit appears in Audit History. | | |
| 8.4 | P1 | Web | Sign in as a user without `shift-summary-approvals.update` and try to approve. | 403; approve button hidden or disabled. | | |
| 8.5 | P0 | Mobile | As a supervisor, open Daily Report for QA Site today. | Report pre-filled from today's ShiftEvents (crew, hours) and auto weather (`OPENWEATHER_API_KEY`). | | |
| 8.6 | P0 | Mobile, Web | Add notes and 2 photos, save. | Photos upload via presigned S3; report visible in web Daily Reports with media. | | |
| 8.7 | P1 | Web | Delete one photo from the report. | Media removed in web and mobile. | | |
| 8.8 | P2 | Web | Analytics → export hours for the week (Pro feature). | On Free/Starter: upgrade prompt. On Pro: export file matches timesheet totals. | | |

## 9. Procore integration (Web + API)

Code: Angular `dashboard/procore`; API `ProcoreController` (`GET/PUT connection`, `POST test`, `POST sync/daily-report/{reportId}`, `POST sync/daily-report/{reportId}/timesheets`), `ProcoreService`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 9.1 | P1 | Web | Procore page → enter sandbox credentials / company / project mapping → save. | Connection stored (secrets not echoed back in `GET connection`). | | |
| 9.2 | P1 | Web | Click **Test connection**. | Success message with the Procore company/project name; bad credentials show a clear error. | | |
| 9.3 | P1 | Web | Sync the daily report from 8.6. | Daily log appears in the Procore sandbox project with notes (and photos if supported). | | |
| 9.4 | P1 | Web | Sync timesheets for that report. | Procore timecard entries match the approved hours from 8.2. | | |
| 9.5 | P2 | Web | Sync the same report twice. | No duplicate Procore entries (or a clear "already synced" message). | | |
| 9.6 | P2 | Web | Disconnect / clear the connection and try to sync. | Sync blocked with "Procore not connected". | | |

## 10. Stripe upgrade and plan limits (Web + Mobile + API)

Code: Angular `/upgrade`, `core/services/billing.service.ts`; Mobile tab `upgrade.tsx`; API `BillingController` (`GET /api/companies/{companyId}/billing`, `POST checkout-session {tier}`, `POST portal-session`), `StripeWebhookController` (`EventUtility.ConstructEvent` signature check) → `StripeWebhookService` (idempotent via `StripeProcessedEvents`; handles `checkout.session.completed` (subscription), `customer.subscription.*`, `invoice.payment_failed`); plans in `Helpers/PlanCatalog.cs` (Free 5 / Starter 25 / Pro 100 / Business unlimited employees, 14-day trial). See also `Docs/STRIPE_BILLING_RUNBOOK.md`.

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 10.1 | P0 | Web | Open `/upgrade` as company admin. | Current plan, trial end date and employee usage shown (`GET billing`). | | |
| 10.2 | P0 | Web, API | Choose Starter → checkout with test card `4242 4242 4242 4242`. | Redirect to Stripe Checkout, then back to the app; webhook marks company Plan = Starter. | | |
| 10.3 | P0 | Web | Retry adding the 6th employee from 3.7. | Now allowed (cap 25). | | |
| 10.4 | P0 | API | `stripe events resend <evt_id>` for the checkout event. | Logged "already processed; skipping"; no double change. | | |
| 10.5 | P0 | API | POST to `/api/stripe/webhook` with a bad `Stripe-Signature`. | 400; nothing written to `StripeProcessedEvents`. | | |
| 10.6 | P1 | Web | Open **Manage billing** (portal) → upgrade to Pro. | `customer.subscription.updated` sets Plan = Pro; analytics/export unlocked. | | |
| 10.7 | P1 | API | Trigger `invoice.payment_failed` (card `4000 0000 0000 0341`). | Company flagged past-due / admin notified per runbook; app shows a billing warning. | | |
| 10.8 | P1 | Web | Cancel subscription in the portal. | After `customer.subscription.deleted`, plan returns to Free and the employee cap applies to new adds (existing people not deleted). | | |
| 10.9 | P1 | Mobile | Open the mobile Upgrade tab as an employee and as an admin. | Employee sees an "ask your admin" message; admin is sent to web checkout (no in-app purchase flow that would break store rules). | | |
| 10.10 | P2 | API | Call `checkout-session` with `tier: "Free"` or an unknown tier. | 400; no Stripe session created. | | |

## 11. Multi-tenant isolation and security (API)

Every resource is scoped by `CompanyId`. Run these with Company 1 = QA Co and Company 2 = a second test company (second company admin account).

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 11.1 | P0 | API | With Company 2 admin's token, `GET /api/companies/{company1}/people`. | 403/404; no Company 1 data. | | |
| 11.2 | P0 | API | With Company 2 token, `GET /api/companies/{company2}/shiftevents/{eventLogId-from-company1}`. | 404 (no cross-tenant lookup by id). | | |
| 11.3 | P0 | API | `POST /api/kiosk/{company2}/clock` with Employee B's `PersonId` (Company 1). | Rejected; no event created in either company. | | |
| 11.4 | P0 | API | `POST /api/auth/verify-pin` with Employee B's `PersonId` and PIN from an unauthenticated client. | Should not let a caller probe PINs for any company's people. **Today: lookup is by PersonId only (blocker 2).** Check rate limiting too. | | |
| 11.5 | P0 | API | `GET /api/kiosk/{company1}/post-clockout?personId=<Company 2 person>`. | Returns nothing for a person outside the company. | | |
| 11.6 | P1 | API | Call a protected endpoint with an expired Firebase token and with an expired API JWT. | 401 on both; mobile app sends the user back to login cleanly. | | |
| 11.7 | P1 | API | Accept-invite with Company 1 token but `companyId` of Company 2. | 404. | | |
| 11.8 | P1 | API | Call `POST /api/companies` as a normal company admin. | 403 (`companies.create` policy). | | |

## 12. Cross-cutting checks (all platforms)

| ID | Pri | Platform | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|
| 12.1 | P0 | All | Search every screen visited above for "ShiftWork", "JobLogSmart" or "ClockShift". | Only "Loqzen" is visible to users (titles, emails, splash, store name). | | |
| 12.2 | P1 | Web, Mobile, Kiosk | Switch language to Spanish and repeat 3.2, 4.2, 6.1, 7.3. | All visible strings translated; dates/times in locale format. | | |
| 12.3 | P1 | Mobile, Kiosk | Rotate devices; test on a small phone and on a 12.9" iPad. | No clipped buttons; touch targets ≥ 48 dp. | | |
| 12.4 | P1 | Web | Run the flow in Chrome, Safari and Edge. | No layout breaks or console errors. | | |
| 12.5 | P2 | API | Check logs/metrics during the run. | No unhandled 500s; funnel events (`RegistrationStarted`, `OnboardingStatusUpdated`, `EmailVerified`) logged. | | |
| 12.6 | P1 | Web | Forgot password from `/forgot-password`. | Reset email (Loqzen branded) arrives; new password works on web and mobile. | | |

## Run sign-off

| Run date | Build / commit | Tester | P0 pass | P0 fail | P1 fail | Go / No-go |
|---|---|---|---|---|---|---|
| | | | | | | |

Automation follow-ups (not part of this manual plan): API integration tests for clock-in/out and tenant isolation (loqzen-daily task 10), Stripe test-mode checklist (task 11).
