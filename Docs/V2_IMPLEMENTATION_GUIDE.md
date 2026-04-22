# V2 Implementation Guide — Agent Task Recipes

**Branch:** `feature/v2-content-communication`
**Spec reference:** `Docs/V2_CONTENT_COMMUNICATION_SPEC.md`
**Project context:** `CLAUDE.md`

This guide breaks the v2 release into discrete, ordered implementation tasks. Each task is self-contained and written so an AI agent can execute it with no additional context. Complete phases in order — later phases depend on earlier ones.

---

## Phase 1 — Backend: Models & Migration

**Goal:** Add all 8 new EF Core models and generate a migration.

### Task 1.1 — Add shared `ContentStatus` enum

**File:** `ShiftWork.Api/Models/Enums.cs` (create if not exists, otherwise append)

Add:
```csharp
public enum ContentStatus { Draft, Published, Archived }
public enum BulletinType { General, Alert, Policy, Safety }
public enum BulletinPriority { Normal, High, Urgent }
public enum MediaType { Photo, Note, Video }
public enum ReportStatus { Draft, Submitted, Approved }
public enum DocumentType { Manual, Procedure, SafetyDataSheet, ProductInfo, FloorPlan, Policy, Other }
public enum DocumentAccessLevel { Public, LocationOnly, Restricted }
public enum SafetyContentType { ToolboxTalk, SafetyDataSheet, Orientation, InstructionalVideo, Training }
```

### Task 1.2 — Create model files

Create these files in `ShiftWork.Api/Models/`:
- `Bulletin.cs` — see spec §1 Data Models
- `BulletinRead.cs` — see spec §1 Data Models
- `LocationDailyReport.cs` + `WeatherSnapshot.cs` record — see spec §2 Data Models
- `ReportMedia.cs` — see spec §2 Data Models
- `Document.cs` — see spec §3 Data Models
- `DocumentReadLog.cs` — see spec §3 Data Models
- `SafetyContent.cs` — see spec §4 Data Models
- `SafetyAcknowledgment.cs` — see spec §4 Data Models

All models follow the existing pattern in `ShiftWork.Api/Models/Person.cs` and `ShiftWork.Api/Models/Location.cs` — use the same namespace and attribute style.

### Task 1.3 — Register DbSets in `ShiftWorkContext.cs`

**File:** `ShiftWork.Api/Data/ShiftWorkContext.cs`

Add 8 new `DbSet<T>` properties and the fluent API configuration from spec §DbContext Changes. Place JSON column converters after the existing `OnModelCreating` configurations.

### Task 1.4 — Generate and apply migration

```bash
cd ShiftWork.Api
dotnet ef migrations add AddContentCommunicationSubsystem
dotnet ef database update
```

Verify migration file created in `ShiftWork.Api/Migrations/`. Check that all 8 tables appear with correct unique indexes.

---

## Phase 2 — Backend: Permissions

**Goal:** Seed all new permission keys and assign them to default roles.

### Task 2.1 — Add permission keys

**File:** `ShiftWork.Api/Services/PermissionSeedService.cs`

Add all 17 new permission keys from spec §New Permissions. Follow the existing `SeedPermissionsAsync` pattern — check for existence before inserting to keep the seed idempotent.

### Task 2.2 — Assign permissions to default roles

**File:** `ShiftWork.Api/Services/RoleSeedService.cs`

Assign permissions per the role matrix in spec §Default Role Assignments. Follow the existing assignment pattern in the file.

---

## Phase 3 — Backend: Services

**Goal:** Implement all business logic services. No controller work yet.

### Task 3.1 — `BulletinService.cs`

**File:** `ShiftWork.Api/Services/BulletinService.cs`

Interface `IBulletinService` with methods:
```csharp
Task<PagedResult<BulletinDto>> GetBulletinsAsync(string companyId, BulletinQueryParams query, int requestingPersonId);
Task<List<BulletinDto>> GetUnreadBulletinsAsync(string companyId, int personId);
Task<BulletinDetailDto> GetBulletinByIdAsync(Guid bulletinId, string companyId, int requestingPersonId);
Task<BulletinDto> CreateBulletinAsync(string companyId, CreateBulletinDto dto, int createdByPersonId);
Task<BulletinDto> UpdateBulletinAsync(Guid bulletinId, string companyId, UpdateBulletinDto dto);
Task ArchiveBulletinAsync(Guid bulletinId, string companyId);
Task MarkAsReadAsync(Guid bulletinId, string companyId, int personId); // idempotent upsert
Task<List<BulletinReadDto>> GetReadsAsync(Guid bulletinId, string companyId);
```

**Push notification:** In `CreateBulletinAsync`, after saving, if `Status == Published` call `IPushNotificationService` to notify affected employees. Fetch device tokens for employees at the bulletin's location (or all company employees if `LocationId == null`).

**Expiry filter:** In `GetBulletinsAsync`, exclude bulletins where `ExpiresAt < DateTime.UtcNow`.

### Task 3.2 — `WeatherService.cs`

**File:** `ShiftWork.Api/Services/WeatherService.cs`

```csharp
public interface IWeatherService
{
    Task<WeatherSnapshot?> GetCurrentWeatherAsync(double latitude, double longitude);
}
```

Implementation:
- Use `IHttpClientFactory` (register named client `"weather"` in `Program.cs`)
- Base URL: `https://api.openweathermap.org/data/2.5/weather`
- API key from `IConfiguration["OPENWEATHER_API_KEY"]`
- Units: `imperial`
- On failure: log warning, return `null` (weather is non-blocking)

### Task 3.3 — `DailyReportService.cs`

**File:** `ShiftWork.Api/Services/DailyReportService.cs`

Key method: `GetOrCreateReportAsync(string companyId, int locationId, DateOnly date, int requestingPersonId)`:
1. Look up existing report for `(companyId, locationId, date)`
2. If none exists AND date is today → create new draft, fetch weather via `IWeatherService`, compute `TotalEmployees`/`TotalHours` from `ShiftEvents` for that date and location
3. Return the report DTO

On `SubmitReportAsync`: snapshot `TotalEmployees` and `TotalHours` from live ShiftEvents into the model before setting `Status = Submitted`.

### Task 3.4 — `DocumentService.cs`

**File:** `ShiftWork.Api/Services/DocumentService.cs`

Key behaviors:
- `GetDocumentsAsync` must apply the `AccessLevel` filter: query the employee's current `LocationId` assignments and `RoleId`s from `UserRole`, then filter documents accordingly.
- `GetDocumentByIdAsync` must generate an S3 pre-signed GET URL (15-minute expiry) via `IAwsS3Service` and log to `DocumentReadLog` (idempotent — one log entry per person per document per day).
- `InitiateUploadAsync` creates the `Document` record with `Status = Draft` and returns a presigned PUT URL via `IAwsS3Service`.
- `ConfirmUploadAsync` sets `Status = Active`.

### Task 3.5 — `SafetyService.cs`

**File:** `ShiftWork.Api/Services/SafetyService.cs`

Key method: `GetAcknowledgmentStatusAsync(Guid safetyContentId, string companyId)`:
1. Get all active employees at the content's location (or all company employees if company-wide)
2. Get all `SafetyAcknowledgment` records for this content
3. Return `{ totalAssigned, totalCompleted, completionRate, completed[], pending[] }`

`AcknowledgeAsync`: upsert — if acknowledgment exists, return success silently (idempotent).

**Scheduled push:** In `CreateSafetyContentAsync`, if `ScheduledFor` is set, register a background notification. In v2, implement as an `IHostedService` that polls every 5 minutes for content where `ScheduledFor <= DateTime.UtcNow AND Status == Published AND NotificationSent == false`. Add `NotificationSent` bool field to `SafetyContent`.

---

## Phase 4 — Backend: Controllers

**Goal:** Expose all API endpoints. Wire up services registered in `Program.cs`.

### Task 4.1 — `BulletinsController.cs`

**File:** `ShiftWork.Api/Controllers/BulletinsController.cs`

Route: `[Route("api/companies/{companyId}/bulletins")]`

Endpoints per spec §1 API Endpoints. Use `[Authorize(Policy = "bulletins.read")]` etc. Extract `personId` from JWT claims using `ClaimTypes.NameIdentifier` → look up `CompanyUser.Uid` → get `PersonId`. Use the existing pattern in `ShiftEventsController.cs`.

### Task 4.2 — `DailyReportsController.cs`

**File:** `ShiftWork.Api/Controllers/DailyReportsController.cs`

Route: `[Route("api/companies/{companyId}/locations/{locationId}/daily-reports")]`

For the `{date}` parameter, accept `DateOnly` parsed from route string `"yyyy-MM-dd"`.

Media upload endpoint accepts `IFormFile` and delegates to `IDailyReportService` which calls `IAwsS3Service` for upload.

### Task 4.3 — `DocumentsController.cs`

**File:** `ShiftWork.Api/Controllers/DocumentsController.cs`

Route: `[Route("api/companies/{companyId}/documents")]`

### Task 4.4 — `SafetyController.cs`

**File:** `ShiftWork.Api/Controllers/SafetyController.cs`

Route: `[Route("api/companies/{companyId}/safety")]`

### Task 4.5 — Register services in `Program.cs`

Add to the DI container:
```csharp
builder.Services.AddScoped<IBulletinService, BulletinService>();
builder.Services.AddScoped<IDailyReportService, DailyReportService>();
builder.Services.AddScoped<IDocumentService, DocumentService>();
builder.Services.AddScoped<ISafetyService, SafetyService>();
builder.Services.AddScoped<IWeatherService, WeatherService>();
builder.Services.AddHttpClient("weather");
```

### Task 4.6 — AutoMapper profiles

**File:** `ShiftWork.Api/Helpers/AutoMapperProfile.cs`

Add `CreateMap<>()` calls for all 8 new models ↔ their DTOs. Follow the existing patterns — do not add inline logic to maps; use `AfterMap` or `ConvertUsing` only if truly necessary.

---

## Phase 5 — Angular Web: Services

**Goal:** Create Angular HTTP services for each new module.

### Task 5.1 — `BulletinService` (Angular)

**File:** `ShiftWork.Angular/src/app/core/services/bulletin.service.ts`

Methods:
```typescript
getBulletins(companyId: string, params?: BulletinQueryParams): Observable<PagedResult<Bulletin>>
getUnreadBulletins(companyId: string): Observable<Bulletin[]>
getBulletin(companyId: string, id: string): Observable<BulletinDetail>
createBulletin(companyId: string, dto: CreateBulletin): Observable<Bulletin>
updateBulletin(companyId: string, id: string, dto: UpdateBulletin): Observable<Bulletin>
archiveBulletin(companyId: string, id: string): Observable<void>
markAsRead(companyId: string, id: string): Observable<void>
getReads(companyId: string, id: string): Observable<BulletinRead[]>
```

Follow the pattern in `ShiftWork.Angular/src/app/core/services/time-off-request.service.ts`.

### Task 5.2 — `DailyReportService` (Angular)

**File:** `ShiftWork.Angular/src/app/core/services/daily-report.service.ts`

### Task 5.3 — `DocumentService` (Angular)

**File:** `ShiftWork.Angular/src/app/core/services/document.service.ts`

Include `initiateUpload(companyId, dto)` → returns presigned URL + documentId, then `confirmUpload(companyId, documentId)` to activate.

### Task 5.4 — `SafetyService` (Angular)

**File:** `ShiftWork.Angular/src/app/core/services/safety.service.ts`

---

## Phase 6 — Angular Web: Feature Modules

**Goal:** Build web UI components.

### Task 6.1 — Bulletins module

**Directory:** `ShiftWork.Angular/src/app/features/dashboard/bulletins/`

Components:
- `BulletinsComponent` — main list with filter toolbar, priority color coding, unread/read indicator
- `BulletinFormComponent` — reactive form for create/edit (slide-over panel using `MatDrawer`)
- `BulletinReadsComponent` — table showing who read it (used inside detail view)

### Task 6.2 — Daily Reports module

**Directory:** `ShiftWork.Angular/src/app/features/dashboard/daily-reports/`

Components:
- `DailyReportsComponent` — location selector + calendar month grid. Each day cell shows report status as colored dot.
- `ReportDetailComponent` — weather widget, attendance table (from ShiftEvents), photo gallery, notes, Submit/Approve buttons, Export button.

### Task 6.3 — Documents module

**Directory:** `ShiftWork.Angular/src/app/features/dashboard/documents/`

Components:
- `DocumentsComponent` — grid of document cards, filter by type (chip group), location dropdown, search input.
- `DocumentUploadComponent` — drag-and-drop zone + metadata form. Upload flow: call `initiateUpload` → upload file to presigned URL → call `confirmUpload`.
- `DocumentDetailComponent` — PDF iframe preview, read log table, version info.

### Task 6.4 — Safety module

**Directory:** `ShiftWork.Angular/src/app/features/dashboard/safety/`

Components:
- `SafetyComponent` — content list with completion rate progress bars (`MatProgressBar`).
- `SafetyCreateComponent` — type selector changes form: text editor (ToolboxTalk) vs file upload (Video/SDS), schedule date picker, acknowledgment toggle.
- `SafetyDetailComponent` — content preview + two-column compliance table (Completed | Pending) + CSV export button.

### Task 6.5 — Register routes

**File:** `ShiftWork.Angular/src/app/features/dashboard/dashboard-routing.module.ts`

Add:
```typescript
{ path: 'bulletins', component: BulletinsComponent },
{ path: 'daily-reports', component: DailyReportsComponent },
{ path: 'documents', component: DocumentsComponent },
{ path: 'safety', component: SafetyComponent },
```

### Task 6.6 — Add sidebar navigation

**File:** `ShiftWork.Angular/src/app/features/dashboard/dashboard.component.html`

Add two new `<div class="nav-section-title">` sections after the Kiosks section:

```html
<div class="nav-section-title">Field Communications</div>
<!-- Bulletins link: icon campaign, route /dashboard/bulletins -->
<!-- Daily Reports link: icon summarize, route /dashboard/daily-reports -->

<div class="nav-section-title">Resources</div>
<!-- Documents link: icon folder_open, route /dashboard/documents -->
<!-- Safety link: icon health_and_safety, route /dashboard/safety -->
```

---

## Phase 7 — Mobile App

**Goal:** Build all mobile screens.

### Task 7.1 — Mobile services

Create in `ShiftWork.Mobile/services/`:
- `bulletin.service.ts`
- `daily-report.service.ts`
- `document.service.ts`
- `safety.service.ts`

All follow the Axios pattern in `ShiftWork.Mobile/services/api.client.ts` — use the shared Axios instance (auth interceptor already attached).

### Task 7.2 — Bulletins tab

**Files:**
- `ShiftWork.Mobile/app/(tabs)/bulletins.tsx` — FlatList of bulletins. Unread items have a colored left border. Tab icon with badge count from `getUnreadBulletins`.
- `ShiftWork.Mobile/app/bulletins/[id].tsx` — Full content view. Call `markAsRead` in `useEffect` on mount.

### Task 7.3 — Daily Report tab

**File:** `ShiftWork.Mobile/app/(tabs)/daily-report.tsx`

Only render if user has `reports.create` permission (check from auth store or role). Show weather widget, auto-populated attendance, photo upload strip, notes text area, Submit button.

Photo upload flow:
1. `expo-image-picker` → get image URI
2. `upload.service.ts` presigned URL → PUT image bytes to S3
3. `POST /daily-reports/{id}/media` with S3 key

### Task 7.4 — Documents tab

**Files:**
- `ShiftWork.Mobile/app/(tabs)/documents.tsx` — category tile grid (6 tiles for 6 document types)
- `ShiftWork.Mobile/app/documents/[id].tsx` — PDF viewer (`react-native-pdf`) with local file caching via `expo-file-system`. Cache key: `documentId-version`. Log read on open.

### Task 7.5 — Safety tab

**Files:**
- `ShiftWork.Mobile/app/(tabs)/safety.tsx` — two sections: Required (pending acknowledgments, red badge) and Library (all published)
- `ShiftWork.Mobile/app/safety/[id].tsx` — content viewer + acknowledge button. Disable button until content fully consumed (scroll to bottom or video 80% watched).

---

## Phase 8 — Kiosk: Post-Clock-Out Interstitials

**Goal:** Surface urgent bulletins and required safety acknowledgments after clock-out.

### Task 8.1 — Post-clock-out check

**File:** `ShiftWork.Kiosk/app/(kiosk)/success.tsx` (modify existing)

After showing success, call:
1. `GET /bulletins/unread?priority=Urgent` for this employee
2. `GET /people/{personId}/safety/pending`

If either returns results, navigate to the interstitial screen instead of resetting to home.

### Task 8.2 — Interstitial screen

**File:** `ShiftWork.Kiosk/app/(kiosk)/post-clockout-notice.tsx` (new)

Renders a queue of notices (max 3 total — bulletins + safety combined). Each notice:
- Shows title + content (truncated to 4 lines)
- Single "Got It" / "I Acknowledge" button
- On tap: calls appropriate API (`markAsRead` or `acknowledge`) → advances to next notice
- After all notices: navigate to home/reset

---

## Phase 9 — Integration & Smoke Tests

### API smoke tests — add to `ShiftWork.Api/ShiftWork.Api.http`

```http
### Create Bulletin
POST {{baseUrl}}/api/companies/{{companyId}}/bulletins
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "title": "Test Bulletin",
  "content": "This is a test bulletin.",
  "type": "General",
  "priority": "Normal"
}

### Get Unread Bulletins
GET {{baseUrl}}/api/companies/{{companyId}}/bulletins/unread
Authorization: Bearer {{token}}

### Get/Create Daily Report for Today
GET {{baseUrl}}/api/companies/{{companyId}}/locations/1/daily-reports/{{today}}
Authorization: Bearer {{token}}

### List Documents
GET {{baseUrl}}/api/companies/{{companyId}}/documents
Authorization: Bearer {{token}}

### List Safety Content
GET {{baseUrl}}/api/companies/{{companyId}}/safety
Authorization: Bearer {{token}}
```

### Verification checklist

- [ ] All 4 new controllers return 401 without auth token
- [ ] Employee cannot see Restricted document outside their role
- [ ] `BulletinRead` unique constraint prevents duplicate read records
- [ ] Weather data appears on today's daily report
- [ ] Document presigned URL expires (test with a 15+ minute delay)
- [ ] Safety acknowledgment is idempotent (second call returns 200, not 409)
- [ ] Kiosk shows urgent bulletin interstitial after clock-out
- [ ] Push notification fires on bulletin publish (verify in Expo push tool)

---

## Agent Notes

- **Order matters:** Complete Phase 1 (models + migration) before any controller or service work.
- **Idempotency:** `MarkAsRead`, `AcknowledgeAsync`, and `ConfirmUploadAsync` must all be idempotent — use upsert patterns.
- **No hard deletes:** Always set `Status = Archived`. Never call `dbContext.Remove()` on content entities.
- **CompanyId isolation:** Every query must include `.Where(x => x.CompanyId == companyId)`. Never skip this.
- **Presigned URLs:** Never return raw S3 keys to clients. Always return pre-signed URLs from `IAwsS3Service`.
- **Test with `.http` file:** After each controller, add a smoke test to `ShiftWork.Api/ShiftWork.Api.http`.
