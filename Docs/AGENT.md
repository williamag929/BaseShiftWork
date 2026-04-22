# ShiftWork Agent Guide (AGENT.md)

This document gives an end-to-end, agent-friendly view of the ShiftWork system: what it does, the APIs to call, core workflows (scheduling, assigning, clocking in/out), and how to run it locally. It also includes concrete “agent tasks” mapping to HTTP endpoints and MCP tools for automation.

## Overview

ShiftWork is a full-stack application to manage workforce scheduling and time tracking:

- Frontend: Angular app with a Kiosk mode for employees to clock in/out, answer location-specific questions, and capture photo/metadata.
- Backend: ASP.NET Core Web API with EF Core for data storage; supports companies, people, schedules, shifts, roles, crews, locations, and shift events (clock actions).
- Agent utilities: Python MCP server and simple clients that expose agent-callable tools for health checks and employee schedule retrieval.

## Architecture

- API: `ShiftWork.Api` (.NET 8 style Program.cs)
  - Auth via Firebase JWT (see notes in “Gaps & Recommendations”).
  - Services for Companies, People, Schedules, ScheduleShifts, TaskShifts, Roles, etc.
  - Persistence via `ShiftWorkContext` (EF Core, SQL Server).
  - Caching: in-memory cache for read endpoints.
  - File storage: AWS S3 client registered.

- Frontend: `ShiftWork.Angular`
  - Features include `kiosk`, `dashboard`, `auth`, `admin`.
  - Kiosk flow integrates Location selection, PIN verification, optional photo capture, and question prompts.
  - Uses `environment.apiUrl` for API base URL and Firebase config from env-injected variables.

- Agent/MCP: `python_client`
  - HTTP MCP server exposing health, ping, tools, and “get employee schedules”.
  - Test interfaces and examples for manual JSON-RPC testing.

## Data Model (high level)

- Company, CompanyUser
- Person (employee)
- Role
- Area, Location (geo/site context)
- Schedule (time-bounded plan for a person/crew at a location/area)
- ScheduleShift (specific person assignment within schedule window)
- TaskShift (activities/tasks inside a shift)
- ShiftEvent (clock events and related metadata)
- KioskQuestion, KioskAnswer (site/company specific prompts)

## Key API Endpoints

Unless noted, endpoints require the `companyId` path segment.

Auth
- `GET /api/auth/user/{email}` → Person by email.
- `POST /api/auth/verify-pin` → `{ personId, pin }` returns `{ verified: boolean }` (BCrypt-based).
- `POST /api/auth/login` (anonymous) → `{ email, password }` → `{ token, personId, companyId, email, name, photoUrl }`. Issues API JWT (BCrypt password, no Firebase).
- `POST /api/auth/accept-invite` (anonymous) → `{ token, companyId, personId, email, password }` → same shape as login. Validates invite token, sets `PasswordHash`, promotes `CompanyUser.Uid` from `invite_*` to `api_*`, returns JWT.
- `POST /api/auth/test-email` (Authorize) → `{ to, subject? }` — sends a test email to verify SMTP config.

Invites (under `/api/companies/{companyId}/people`)
- `POST /api/companies/{companyId}/people/{personId}/send-invite` → `{ roleIds, inviteUrl }`. Detects pending vs active user and sends invite/resend/password-reset email. Logs audit entry. (`PeopleController.SendInvite`)

Schedules
- `GET /api/companies/{companyId}/schedules` → list schedules (DTO).
- `GET /api/companies/{companyId}/schedules/{scheduleId}`
- `POST /api/companies/{companyId}/schedules` → create schedule.
- `PUT /api/companies/{companyId}/schedules/{scheduleId}` → update schedule.
- `DELETE /api/companies/{companyId}/schedules/{scheduleId}` → delete schedule.
- `GET /api/companies/{companyId}/schedules/search?personId=&locationId=&startDate=&endDate=&searchQuery=` → filters.

Schedule Shifts
- `GET /api/companies/{companyId}/scheduleshifts`
- `GET /api/companies/{companyId}/scheduleshifts/{shiftId}`
- `POST /api/companies/{companyId}/scheduleshifts`
- `PUT /api/companies/{companyId}/scheduleshifts/{shiftId}`
- `DELETE /api/companies/{companyId}/scheduleshifts/{shiftId}`

Shift Events (Clock actions)
- `GET /api/companies/{companyId}/shiftevents` → all events in company.
- `GET /api/companies/{companyId}/shiftevents/{eventLogId}` → single event.
- `GET /api/companies/{companyId}/shiftevents/person/{personId}` → events per person.
- `GET /api/companies/{companyId}/shiftevents/eventtype/{eventType}` → filtered by event type.
- `POST /api/companies/{companyId}/shiftevents` → create clock event.
- `PUT /api/companies/{companyId}/shiftevents/{eventLogId}` → update clock event.
- `DELETE /api/companies/{companyId}/shiftevents/{eventLogId}` → delete clock event.

Time-Off Requests
- `GET /api/companies/{companyId}/timeoff-requests` → list time-off requests (filters: personId, status, startDate, endDate).
- `GET /api/companies/{companyId}/timeoff-requests/{requestId}` → single request.
- `POST /api/companies/{companyId}/timeoff-requests` → create time-off request.
- `PATCH /api/companies/{companyId}/timeoff-requests/{requestId}/approve` → approve/deny with notes; auto-creates ShiftEvent on approval.
- `DELETE /api/companies/{companyId}/timeoff-requests/{requestId}` → cancel request (pending only).

PTO Balance
- `GET /api/companies/{companyId}/pto/balance/{personId}` → current PTO balance (optional `asOf` query param).
- `PUT /api/companies/{companyId}/pto/config/{personId}` → configure accrual rate, starting balance, start date.

Kiosk
- `GET /api/kiosk/{companyId}/questions` → active kiosk questions.
- `POST /api/kiosk/answers` → submit list of kiosk answers.

Webhooks (Automatic)
- Webhook notifications are automatically triggered on the following events:
  - `employee.created` → when a new Person is created via POST `/api/companies/{companyId}/people`
  - `employee.updated` → when a Person is updated via PUT `/api/companies/{companyId}/people/{personId}`
  - `location.created` → when a new Location is created via POST `/api/companies/{companyId}/locations`
  - `location.updated` → when a Location is updated via PUT `/api/companies/{companyId}/locations/{locationId}`
- Webhooks are sent to the URL configured in the `WEBHOOK_URL` environment variable.
- Each webhook includes:
  - `eventType` (e.g., "employee.created")
  - `timestamp` (UTC timestamp)
  - `data` (the complete Person or Location DTO)
  - `X-ShiftWork-Signature` header (HMAC SHA256 signature for verification)
- Webhooks use retry logic with exponential backoff (up to 3 attempts).

People, Locations, Roles, Companies, Crews, etc.
- Similar REST patterns exist in `Controllers/` to manage these resources.

## DTO Highlights

ScheduleDto (partial)
- `ScheduleId:int`, `CompanyId:string`, `PersonId:int`, `LocationId:int`, `AreaId:int`, `StartDate:Date`, `EndDate:Date`, `Status:string`.

ScheduleShiftDto (partial)
- `ScheduleShiftId:int`, `ScheduleId:int`, `CompanyId:string`, `LocationId:int`, `AreaId:int`, `PersonId:int`, `StartDate:Date`, `EndDate:Date`, `Status:string`.

ShiftEventDto
- `EventLogId:Guid`, `EventDate:Date`, `EventType:string`, `CompanyId:string`, `PersonId:int`, plus optional metadata (`GeoLocation`, `PhotoUrl`, `KioskDevice`, etc.).

Note: Resolved — `ScheduleDto.PersonId` is now `int` to match `ScheduleShiftDto.PersonId`. AutoMapper maps the model's string `PersonId` to DTO `int` and back.

## Frontend Flows (Kiosk)

1) Location selection
- If no active location is set for the kiosk, a dialog prompts selection (loaded from Locations API by `companyId`).

2) Employee identification
- Select employee and optionally verify PIN via `POST /api/auth/verify-pin`.

3) Clock action + prompts
- Capture photo, gather kiosk questions via `GET /api/kiosk/{companyId}/questions`, then submit answers to `POST /api/kiosk/answers`.
- Create a shift clock event via `POST /api/companies/{companyId}/shiftevents` with event metadata (`EventType` like “clock_in”, “clock_out”, etc.).

4) Review
- Dashboard components also record shift events via the same service used in kiosk.

## Agent Task Recipes (HTTP)

Find upcoming shifts for a person
- Call: `GET /api/companies/{companyId}/schedules/search?personId={id}&startDate={ISO}&endDate={ISO}`
- Or list shifts: `GET /api/companies/{companyId}/scheduleshifts` then filter by `PersonId`, timeframe.

Clock in
- Build `ShiftEventDto` with `EventType: "clock_in"`, `EventDate: now`, `CompanyId`, `PersonId`, and optional `GeoLocation`, `PhotoUrl`, `KioskDevice`.
- POST to `/api/companies/{companyId}/shiftevents`.

Clock out
- Same as Clock in but `EventType: "clock_out"` and new `EventDate`.

Answer kiosk questions
- GET `/api/kiosk/{companyId}/questions`.
- Build list of `KioskAnswer` objects and `POST /api/kiosk/answers`.

Verify an employee’s PIN
- `POST /api/auth/verify-pin` with `{ personId:int, pin:string }` → `{ verified:boolean }`.

Assign a person to a shift
- Create or update a `ScheduleShiftDto` via `POST/PUT /api/companies/{companyId}/scheduleshifts`.

## MCP Tools (Python)

The `python_client` folder contains a simple HTTP MCP server exposing:

- `GET /health` and `GET /ping`
- `GET /api/tools` to enumerate tools
- `GET /api/employees/{company_id}/{person_id}/schedules` and `POST /api/employees/schedules` for schedules
- `POST /api/tools/execute` to run a tool

Run (Windows PowerShell):

```powershell
# From python_client directory
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python http_mcp_server.py --mode http --port 8080
```

Examples: see `python_client/README.txt` for manual JSON-RPC testing and CLI helpers.

REST client
- Use `ShiftWork.Api/ShiftWork.Api.http` for quick requests (verify PIN, shift events, kiosk).

## Local Development (Windows)

Backend (.NET API)

Environment variables expected (Program.cs):
- `DB_CONNECTION_STRING` (SQL Server connection string)
- `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_API_KEY` (see notes below)
- `WEBHOOK_URL` (optional; webhook endpoint URL for integration with external systems like Zapier, n8n, Make, or custom clients)
- `WEBHOOK_SECRET_KEY` (optional; secret key for HMAC SHA256 signature; defaults to "default-secret-key")

Run:

```powershell
# From ShiftWork.Api
$env:DB_CONNECTION_STRING = "Server=localhost;Database=ShiftWork;User Id=sa;Password=Your_password123;TrustServerCertificate=True;"
$env:FIREBASE_PROJECT_ID = "your-project"
$env:FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"
$env:FIREBASE_API_KEY = "your-firebase-web-api-key"
dotnet restore
dotnet build
dotnet run
```

Frontend (Angular)

Environment variables (webpack DefinePlugin/custom config) referenced in `environment.ts`:
- `API_URL`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`

Run:

```powershell
# From ShiftWork.Angular
$env:API_URL = "https://localhost:5001"  # match API base
$env:FIREBASE_API_KEY = "your-firebase-web-api-key"
$env:FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"
$env:FIREBASE_PROJECT_ID = "your-project"
$env:FIREBASE_STORAGE_BUCKET = "your-project.appspot.com"
$env:FIREBASE_MESSAGING_SENDER_ID = "000000000000"
$env:FIREBASE_APP_ID = "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
npm install
npm run start
```

## Security & Auth Notes

### Dual JWT Scheme

The API supports **two authentication schemes**:

1. **Firebase JWT** (default, for Angular admin users) — validated against `https://securetoken.google.com/{projectId}`. JWT subject = Firebase UID.
2. **API JWT** (for mobile invited employees) — issued by `POST /api/auth/login` and `POST /api/auth/accept-invite`. Signed with `JwtSettings:SecretKey`, issuer `shiftwork-api`, audience `shiftwork-mobile`. JWT subject = `CompanyUser.Uid` (`api_{guid}`).

Key rules:
- `PermissionAuthorizationHandler` looks up `CompanyUser.Uid == JWT.NameIdentifier` first; falls back to `CompanyUser.Email == JWT.Email` to support legacy tokens.
- `GET /api/companies/my` extracts both UID and email claims and passes email to `GetCompaniesByUidAsync` as a fallback for API JWT users.
- `Person.PasswordHash` (BCrypt) is set only for mobile-app users who have accepted an invite. Firebase admin users authenticate via Firebase only.

### Invite Flow

1. Admin sends invite via `POST .../people/{id}/send-invite` → creates/updates `CompanyUser` with `Uid = invite_{guid}` → sends email.
2. Employee opens invite email link → `GET /auth/accept-invite?token=...&companyId=...&personId=...&email=...&name=...`.
3. Angular accept-invite page POSTs to `POST /api/auth/accept-invite` with token + password.
4. API sets `PasswordHash`, promotes `Uid` to `api_{guid}`, returns JWT.
5. Mobile: after accept-invite or regular login, app navigates to `/(auth)/company-select` which auto-selects if there's only one company.

- Firebase JWT validation now uses Google's public keys via `Authority = https://securetoken.google.com/{projectId}` with issuer/audience checks. No symmetric signing key is configured from the web API key.
- CORS allows several origins including localhost and production domains.
- Kiosk endpoints now require auth via `[Authorize]`. Include `Authorization: Bearer <JWT>` on:
  - `GET /api/kiosk/{companyId}/questions`
  - `POST /api/kiosk/answers`
  See `ShiftWork.Api/ShiftWork.Api.http` which includes a `@token` placeholder.

## Gaps & Recommendations (Code Review)

1) Firebase JWT configuration
- Updated: uses standard Firebase `Authority`/issuer/audience validation; env var corrected to `FIREBASE_API_KEY`.

2) Service provider build inside `AddDbContext`
- Resolved: `AddDbContext((sp, options) => { options.AddInterceptors(sp.GetRequiredService<AuditInterceptor>()); })` — avoids building a separate provider.

3) Layering consistency
- Resolved: `KioskController` now uses `IKioskService` instead of `DbContext` directly.

4) DTO type inconsistency
- Resolved: `ScheduleDto.PersonId` updated to `int`. AutoMapper handles conversion to/from the model's `string` `PersonId`.

5) ShiftEvents API vs Angular client
- Resolved: `ShiftEventsController` implements `PUT` and `DELETE` to match the Angular client.

6) Minor docs mismatch
- In `ScheduleShiftsController`, XML docs for `PUT` say 204 (NoContent) but code returns `Ok(...)`. Align documentation with behavior.

7) FirebaseApp initialization
- `FirebaseApp.Create()` is commented out. If needed for Admin SDK features, initialize with proper credentials or planned usage; otherwise remove leftovers.

## Example Payloads

Create Shift Event (clock in):

```json
{
  "eventDate": "2025-11-05T14:30:00Z",
  "eventType": "clock_in",
  "companyId": "acme-123",
  "personId": 42,
  "description": "Kiosk clock-in",
  "kioskDevice": "front-gate-tablet",
  "geoLocation": "40.741895,-73.989308",
  "photoUrl": "https://s3.amazonaws.com/bucket/photo.jpg"
}
```

Create Schedule Shift:

```json
{
  "scheduleId": 1001,
  "companyId": "acme-123",
  "locationId": 10,
  "areaId": 1,
  "personId": 42,
  "startDate": "2025-11-06T09:00:00Z",
  "endDate": "2025-11-06T17:00:00Z",
  "status": "Assigned",
  "notes": "Day shift"
}
```

Webhook Payload (Automatic):

When a Person or Location is created/updated, a webhook is automatically sent to the configured `WEBHOOK_URL`:

```json
{
  "eventType": "employee.created",
  "timestamp": "2025-11-05T14:30:00Z",
  "data": {
    "personId": 42,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "companyId": "acme-123",
    "phoneNumber": "+1234567890",
    "status": "Active",
    "roleId": 5
  }
}
```

Headers include `X-ShiftWork-Signature` with HMAC SHA256 hash for verification.

## Agent Playbook (LLM/MCP)

When integrated as an automated agent:

- Determine active company and employee context (email → person via `GET /api/auth/user/{email}` or app state), then derive `companyId` and `personId`.
- For clock workflows, optionally verify PIN first (`POST /api/auth/verify-pin`).
- Fetch kiosk questions if in kiosk mode, collect answers, and submit them.
- Post a `ShiftEvent` with clear `eventType` values: `clock_in`, `clock_out`, `break_start`, `break_end` as needed.
- For scheduling automation, use `schedules/search` to propose or validate assignments, then create/update `Schedule` and `ScheduleShift`.

MCP Tool Mapping (from `python_client`):
- Health: `GET /health`, `GET /ping`
- Tools list: `GET /api/tools`
- Employee schedules: `GET /api/employees/{company_id}/{person_id}/schedules`
- Generic tool execution: `POST /api/tools/execute`

## Quick Smoke Tests

After both API and Angular are running:

1) Swagger (dev): visit `https://localhost:{api-port}/swagger`.
2) Kiosk feature: navigate to `/kiosk` in the Angular app, select a location, choose an employee, verify PIN, and perform a clock in.
3) Check shift events: `GET /api/companies/{companyId}/shiftevents/person/{personId}` should show the new event.

---

## Recent Features Implemented

### Employee Invite / Password-Reset Flow (Complete)
- `POST /api/auth/login` — BCrypt-based API login for mobile users; returns API JWT.
- `POST /api/auth/accept-invite` — validates invite token, sets `PasswordHash`, promotes `CompanyUser.Uid`, returns JWT.
- `PeopleController.SendInvite` — detects pending invite (`invite_*`) vs active user (`api_*`) and sends the appropriate contextual email (invite / resend / password-reset) via SMTP/Zoho.
- Audit logging via `AuditLogService.LogInviteSentAsync` on every invite action.
- Angular `people.component.ts` `sendInvite()` correctly sends `/auth/accept-invite` as the invite URL.
- Angular `accept-invite.component.ts` fully rewritten — no Firebase dependency; `invalidLink` flag shows an in-page error instead of redirecting; `+` characters in name query param decoded correctly.

### Company-Switch Email Fallback (Complete)
- `ICompanyService.GetCompaniesByUidAsync(uid, email?)` — if UID lookup returns empty and email provided, falls back to matching `CompanyUser.Email`.
- `GET /api/companies/my` — extracts both UID and email claims from JWT; passes email as fallback. Works for both Firebase admin users (UID match) and API JWT employees (email fallback).

### Time-Off Management (MVP Complete)
- **TimeOffRequest** model with approval workflow (Pending/Approved/Denied/Cancelled states)
- Full CRUD API endpoints with overlap validation and hours calculation
- Angular modal for requesting time off with partial day support
- Auto-creates ShiftEvent on approval to trigger shift opening logic
- Manager approval dashboard with filters, pagination, and inline notes
- PTO balance integration: displays balance with insufficient warnings

### PTO Balance Tracking (MVP Complete)
- **PTOLedger** model tracking accruals, usage, and running balances
- Monthly accrual system with per-person configuration (rate, starting balance, start date)
- Automatic deduction on approval for Vacation/PTO types
- Before/after balance snapshot stored on TimeOffRequest
- PtoService with idempotent accrual generation (no duplicates)
- REST endpoints for balance queries and configuration
- Angular PTO service and balance display in approvals UI

### Notification Service (Complete)
- Multi-channel support: Email (SMTP), SMS (Twilio), Push (simulated)
- Configurable per notification via channel parameter
- Integrated into replacement request notifications
- Time-off decision notifications (approve/deny) sent to requester
- Graceful fallback when providers not configured (simulation mode)

### Sick Event Reporting (MVP Complete)
- Dedicated modal with multi-day support
- Symptom tracking and doctor's note indicator
- ShiftEventService automatically opens overlapping shifts
- Rich metadata capture (symptoms, requiresDoctor, notes)

### Replacement Candidate System (MVP Complete)
- Filter replacement candidates by availability and conflicts
- Side panel UI showing candidates with reasons and scores
- Channel selector for notifications (push/SMS/email)
- Notify and assign functionality
- ReplacementRequest model with full workflow endpoints

### Schedule Publishing & Repeats
- Smart publish badge showing pending count
- Click-to-publish all unpublished shifts for current week
- Visual feedback with status colors
- Repeat patterns: tomorrow, rest of week, custom days selection
- View shift history modal showing past shifts and events

---

## Notification Service

The backend includes a Notification Service used to contact replacement candidates via push (simulated), SMS, or email. If third-party providers aren’t configured, notifications are simulated via logs so the workflow remains testable.

Channels and configuration (appsettings or environment variables):
- Email (SMTP)
  - Smtp:Host
  - Smtp:Port
  - Smtp:Username
  - Smtp:Password
  - Smtp:From
- SMS (Twilio)
  - Twilio:AccountSid
  - Twilio:AuthToken
  - Twilio:From
- Push
  - Currently simulated; future integration could target Firebase Cloud Messaging or a mobile backend.

Endpoints:
- POST /api/companies/{companyId}/replacement-requests → Create a replacement request for a shift
- POST /api/companies/{companyId}/replacement-requests/{requestId}/notify → Notify candidates
  - Body: { "personIds": [number], "channel": "push" | "sms" | "email" }
  - Response: { attempted, succeeded, failed, channel, errors }

Frontend hooks:
- Replacement panel includes a channel selector (Push/SMS/Email). Clicking Notify calls the API with the chosen channel.
- If no providers are configured for the channel, the server logs simulated sends and returns an attempted count for UX feedback.

Notes:
- Prefer push for development/testing since it requires no external credentials.
- For production SMS/Email, set the config keys above and verify that People records include up-to-date email/phone.

## Company Settings - Pending Code Implementation (22)

The Company Settings UI is complete with 8 tabs covering all configuration options. The following backend enforcement/automation features require implementation:

### ⏰ Clock-In/Out Enforcement (5 items)
- [ ] **Geo-fence clock-in enforcement** - Validate clock-in coordinates against `geoFenceRadius` when `requireGeoLocationForClockIn` is enabled; reject if outside fence
- [ ] **Auto clock-out scheduler** - Background job to find employees clocked in beyond `autoClockOutAfter` hours and auto-create clock-out events
- [ ] **Grace period for late arrivals** - Implement `gracePeriodLateClockIn` logic: allow late clock-ins within X minutes without marking as late in attendance records
- [ ] **Early clock-in rules** - Enforce `allowEarlyClockIn` threshold: reject clock-ins more than X minutes before scheduled shift start
- [ ] **Break clock enforcement** - If `requireBreakClocks` is true, enforce break start/end event tracking and validate `minimumBreakDuration`

### 💰 Pay & Overtime Calculations (1 item)
- [ ] **Overtime multipliers (night/holiday/weekend)** - Calculate overtime pay using `nightShiftOvertimePercentage`, `holidayOvertimePercentage`, `weekendOvertimePercentage` based on shift time ranges and company calendar settings

### 🏖️ PTO & Leave Automation (3 items)
- [ ] **PTO accrual scheduler** - Monthly background job that adds `defaultPtoAccrualRate` hours to employee balances; enforce `maximumPtoBalance` cap
- [ ] **Sick leave accrual scheduler** - Monthly job for `sickLeaveAccrualRate` with `sickLeaveMaximumBalance` cap
- [ ] **Annual PTO rollover logic** - Year-end job that rolls over up to `maximumPtoRollover` hours if `ptoRolloverAllowed` is true; reset excess hours

### 📋 Scheduling Workflows (2 items)
- [ ] **Auto-approve shifts setting** - If `autoApproveShifts` is true, set shift.status to Approved on creation; otherwise Pending
- [ ] **Shift swap approval workflow** - If `requireManagerApprovalForSwaps` is true, create approval workflow; otherwise auto-approve swap requests

### 🔔 Notification Automation (2 items)
- [ ] **Notification triggers implementation** - Send push/email/SMS when `notifyOnShiftAssignment`, `notifyOnShiftChanges`, `notifyOnTimeOffApproval`, `notifyOnReplacementRequest` are enabled
- [ ] **Shift reminder scheduler** - Background job that sends notifications X hours before shift start based on `reminderHoursBeforeShift` setting

### 🖥️ Kiosk Features (2 items)
- [ ] **Kiosk photo on clock-in** - If `requirePhotoOnClockIn` is true, capture photo on clock-in and attach to attendance/shift event record
- [ ] **Kiosk custom questions** - If `allowQuestionResponsesOnClockIn` is true, display custom questions on kiosk and store answers with clock event

### 🔐 Security Enforcement (2 items)
- [ ] **Password expiration enforcement** - If `passwordExpirationDays` > 0, track last password change date and force reset on expiration
- [ ] **Session timeout middleware** - Enforce `sessionTimeout` in auth middleware; auto-logout idle sessions after X minutes

### ✅ Already Implemented Settings
These settings are validated and enforced in existing code:
- ✅ Maximum consecutive work days (`MaximumConsecutiveWorkDays`)
- ✅ Minimum hours between shifts (`MinimumHoursBetweenShifts`)
- ✅ Daily/weekly hour limits (`MaximumDailyHours`, `MaximumWeeklyHours`)
- ✅ Overlapping shifts prevention (`AllowOverlappingShifts`)

---

---

## V2 Content & Communication Subsystem (Branch: `feature/v2-content-communication`)

Full spec: `Docs/V2_CONTENT_COMMUNICATION_SPEC.md`
Implementation tasks: `Docs/V2_IMPLEMENTATION_GUIDE.md`
Agent definition: `.github/agents/content-specialist.yml`

### New Models (8)
`Bulletin`, `BulletinRead`, `LocationDailyReport`, `ReportMedia`, `Document`, `DocumentReadLog`, `SafetyContent`, `SafetyAcknowledgment`

### New API Endpoints

Bulletins
- `GET /api/companies/{cid}/bulletins` → list (query: locationId, type, status, page)
- `GET /api/companies/{cid}/bulletins/unread` → unread for authenticated employee
- `GET /api/companies/{cid}/bulletins/{id}` → detail + isReadByCurrentUser
- `POST /api/companies/{cid}/bulletins` → create; triggers push notification
- `PUT /api/companies/{cid}/bulletins/{id}` → update
- `DELETE /api/companies/{cid}/bulletins/{id}` → archive
- `POST /api/companies/{cid}/bulletins/{id}/read` → mark as read (idempotent)
- `GET /api/companies/{cid}/bulletins/{id}/reads` → who has read (manager)

Daily Reports
- `GET /api/companies/{cid}/locations/{lid}/daily-reports` → list for location
- `GET /api/companies/{cid}/locations/{lid}/daily-reports/{date}` → get or auto-create (date: yyyy-MM-dd). Auto-fetches weather for today.
- `PUT /api/companies/{cid}/locations/{lid}/daily-reports/{id}` → update notes / submit
- `POST /api/companies/{cid}/locations/{lid}/daily-reports/{id}/media` → upload photo (multipart)
- `DELETE /api/companies/{cid}/locations/{lid}/daily-reports/{id}/media/{mediaId}` → remove photo
- `GET /api/companies/{cid}/locations/{lid}/daily-reports/{id}/export` → PDF (returns 501 in v2)

Documents
- `GET /api/companies/{cid}/documents` → list filtered by caller's access level
- `GET /api/companies/{cid}/documents/{id}` → detail + 15-min presigned S3 URL; logs read event
- `POST /api/companies/{cid}/documents` → initiate upload; returns presigned PUT URL + documentId
- `PATCH /api/companies/{cid}/documents/{id}/confirm` → activate after S3 upload
- `PUT /api/companies/{cid}/documents/{id}` → update metadata
- `DELETE /api/companies/{cid}/documents/{id}` → archive
- `GET /api/companies/{cid}/documents/{id}/read-logs` → compliance log (manager)

Safety
- `GET /api/companies/{cid}/safety` → list (query: type, locationId, status)
- `GET /api/companies/{cid}/safety/{id}` → detail + caller's acknowledgment status
- `POST /api/companies/{cid}/safety` → create; schedules push if ScheduledFor is set
- `PUT /api/companies/{cid}/safety/{id}` → update
- `DELETE /api/companies/{cid}/safety/{id}` → archive
- `POST /api/companies/{cid}/safety/{id}/acknowledge` → employee sign-off (idempotent)
- `GET /api/companies/{cid}/safety/{id}/acknowledgments` → { completed[], pending[], completionRate }
- `GET /api/companies/{cid}/people/{pid}/safety/pending` → pending required items for employee

### New Environment Variable
`OPENWEATHER_API_KEY` — free tier key from openweathermap.org; used in `WeatherService` for daily reports.

### New Permissions (17)
`bulletins.create`, `bulletins.read`, `bulletins.delete`, `bulletins.track-reads`,
`reports.create`, `reports.view`, `reports.export`, `reports.approve`,
`documents.upload`, `documents.read`, `documents.delete`, `documents.view-logs`, `documents.manage-access`,
`safety.create`, `safety.read`, `safety.delete`, `safety.acknowledge`, `safety.track`

### Agent Task Recipe: Check Bulletin Compliance

```
1. GET /api/companies/{cid}/bulletins?status=Published
2. For each bulletin: GET /api/companies/{cid}/bulletins/{id}/reads
3. Compare reads list against active employees at bulletin's locationId
4. Employees not in reads list → pending acknowledgment
```

### Agent Task Recipe: Check Safety Compliance for a Location

```
1. GET /api/companies/{cid}/safety?locationId={lid}&status=Published
2. For each required item (isAcknowledgmentRequired=true):
   GET /api/companies/{cid}/safety/{id}/acknowledgments
3. Response.pending[] → employees still needing to acknowledge
```

### Agent Task Recipe: Submit Daily Report

```
1. GET /api/companies/{cid}/locations/{lid}/daily-reports/{today}
   → auto-creates draft with weather + ShiftEvent aggregates
2. POST /api/companies/{cid}/locations/{lid}/daily-reports/{id}/media
   → upload photos (multipart)
3. PUT /api/companies/{cid}/locations/{lid}/daily-reports/{id}
   Body: { "notes": "...", "status": "Submitted" }
```

---

## Potential Future Enhancements (Backlog)

### 🔄 Shift Management
- **Shift Swap/Trade** - Allow employees to exchange shifts with approval workflow
- **Recurring Shift Patterns** - Define templates (e.g., every Monday 9-5) for bulk scheduling
- **Shift Conflict Warnings** - Alert when assigning overlapping or double-booked shifts
- **Overtime Tracking** - Calculate and display weekly/monthly overtime hours with alerts

### 📅 Time-Off & Scheduling
- **Calendar/Timeline View** - Visual calendar showing time-off requests, sick days, and availability
- ✅ **PTO Accrual System** - Backend complete with monthly accrual, balance tracking, automatic deductions on approval. UI displays balances in approval screen with insufficient balance warnings.
- ✅ **Time-Off Approval Dashboard** - Manager view with filters, pagination, inline notes, approve/deny actions. Displays PTO balances for Vacation/PTO requests.
- **Team Availability View** - Show who's available/unavailable across date ranges
- **Person PTO Configuration UI** - Interface to set accrual rate, starting balance, and start date per employee

### 🔔 Notifications & Communication
- ✅ **Real Notification Service** - Email (SMTP), SMS (Twilio), and push (simulated) implemented with configurable channels
- ✅ **Replacement Request Alerts** - Notify candidates via push/SMS/email when selected for replacement
- ✅ **Approval Notifications** - Alert employees via push notification when time-off approved/denied
- **Shift Reminder Notifications** - Remind employees of upcoming shifts

### 📊 Reporting & Analytics
- **Shift History View** - Complete history modal showing past shifts, clock times, events per person
- [ ] **Historic Actions Report (People Module)** - Add option on people/employees view to see last 10 historic actions (clock-in, clock-out, published, approved timesheet); implement as time-lapse report from newer to older with page navigation
- **Attendance Reports** - Generate reports on late arrivals, absences, overtime
- **Labor Cost Analysis** - Track labor costs by location, department, time period
- **Schedule Coverage Heatmap** - Visual representation of staffing levels

### 📱 Mobile & User Experience
- **Mobile App Integration** - Native apps for clock-in/out, time-off requests, schedule viewing
- **Offline Mode** - Support offline clock events with sync when connection restored
- **Biometric Clock-In** - Fingerprint/face recognition for time tracking; photo comparison with accuracy percentage score to verify identity against stored profile photos
- **Geofencing** - Restrict clock-in/out to specific locations

### 🔐 Security & Compliance
- **Audit Trail** - Comprehensive logging of all schedule changes, approvals, edits
- **Role-Based Permissions** - Fine-grained access control (manager, supervisor, employee)
- **Labor Law Compliance** - Break time rules, minimum rest periods, overtime limits
- **Data Export** - Export schedules and time data for payroll integration

### 🤖 Automation & Intelligence
- **Smart Scheduling** - AI-powered shift assignment based on skills, availability, preferences
- **Predictive Staffing** - Forecast staffing needs based on historical data
- **Auto-Fill Open Shifts** - Automatically suggest and assign replacements for open shifts
- **Shift Marketplace** - Let employees claim available/open shifts

---

ShiftEvents PUT/DELETE, Firebase JWT configuration, and DTO alignment have been implemented.
