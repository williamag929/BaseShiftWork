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

Kiosk
- `GET /api/kiosk/{companyId}/questions` → active kiosk questions.
- `POST /api/kiosk/answers` → submit list of kiosk answers.

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

ShiftEvents PUT/DELETE, Firebase JWT configuration, and DTO alignment have been implemented.
