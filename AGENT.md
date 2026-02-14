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
