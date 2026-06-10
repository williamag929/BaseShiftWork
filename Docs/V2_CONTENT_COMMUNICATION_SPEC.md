# V2 Content & Communication Subsystem — Technical Specification

**Branch:** `feature/v2-content-communication`
**Version:** 2.0
**Status:** Approved for implementation

---

## Overview

This document is the authoritative technical specification for four new modules introduced in ShiftWork v2. All implementation decisions must align with this spec. Deviations require architect review.

### Modules

| # | Module | Purpose | Audience |
|---|---|---|---|
| 1 | [Bulletins](#1-bulletins) | Operational announcements with read tracking | All employees |
| 2 | [Daily Reports](#2-daily-reports) | Location-scoped daily operational reports | Supervisors, Managers |
| 3 | [Documents](#3-documents) | Role-filtered reference document library | All (filtered by access level) |
| 4 | [Safety](#4-safety) | Compliance-tracked safety content with mandatory acknowledgment | Supervisors track; all complete |

### Surfaces Affected

- **API** (`ShiftWork.Api`) — 4 new controllers, 8 new models, new permissions
- **Web** (`ShiftWork.Angular`) — 4 new dashboard modules, 2 new sidebar sections
- **Mobile** (`ShiftWork.Mobile`) — 4 new tab screens + detail screens
- **Kiosk** (`ShiftWork.Kiosk`) — post-clock-out interstitial for urgent bulletins and required safety

---

## Shared Patterns

All four modules follow these conventions:

**API URL pattern:** `/api/companies/{companyId}/{resource}`

**Soft delete:** All content uses `Status` enum (Draft | Published | Archived). No hard deletes.

**Multi-tenancy:** Every model carries `CompanyId`. API always filters by `CompanyId` from the auth context.

**S3 storage:** Files (PDFs, photos, videos) are stored in S3. API returns pre-signed URLs with 15-minute expiry for downloads. Uploads use the presigned-URL pattern: client requests a signed upload URL → client uploads directly to S3 → client notifies API with the final key.

**Audit:** `AuditInterceptor` automatically logs all Create/Update/Delete. No manual audit calls needed.

---

## 1. Bulletins

### Purpose

Replace informal communication (text messages, printed papers) with a structured announcement board. Managers post bulletins; employees read them on mobile; the kiosk surfaces urgent ones at clock-out.

### Data Models

```csharp
public class Bulletin
{
    public Guid BulletinId { get; set; }
    public string CompanyId { get; set; }
    public int? LocationId { get; set; }          // null = company-wide
    public string Title { get; set; }              // max 100 chars
    public string Content { get; set; }            // plain text or markdown
    public BulletinType Type { get; set; }         // General | Alert | Policy | Safety
    public BulletinPriority Priority { get; set; } // Normal | High | Urgent
    public List<string> AttachmentUrls { get; set; } = new(); // JSON in DB
    public DateTime PublishedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }       // null = never expires
    public int CreatedByPersonId { get; set; }
    public ContentStatus Status { get; set; }      // Draft | Published | Archived
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Location? Location { get; set; }
    public Person CreatedBy { get; set; }
    public ICollection<BulletinRead> Reads { get; set; } = new List<BulletinRead>();
}

public class BulletinRead
{
    public Guid BulletinReadId { get; set; }
    public Guid BulletinId { get; set; }
    public int PersonId { get; set; }
    public DateTime ReadAt { get; set; }

    public Bulletin Bulletin { get; set; }
    public Person Person { get; set; }
}

public enum BulletinType { General, Alert, Policy, Safety }
public enum BulletinPriority { Normal, High, Urgent }
```

**DB constraint:** Unique index on `(BulletinId, PersonId)` in `BulletinRead`.

### DTOs

```csharp
// Output
public class BulletinDto
{
    public Guid BulletinId { get; set; }
    public string Title { get; set; }
    public string Content { get; set; }
    public string Type { get; set; }
    public string Priority { get; set; }
    public List<string> AttachmentUrls { get; set; }
    public DateTime PublishedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string Status { get; set; }
    public int? LocationId { get; set; }
    public string CreatedByName { get; set; }
    public bool IsReadByCurrentUser { get; set; }  // computed per request
    public int TotalReads { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Input
public class CreateBulletinDto
{
    public string Title { get; set; }
    public string Content { get; set; }
    public BulletinType Type { get; set; }
    public BulletinPriority Priority { get; set; }
    public int? LocationId { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<string>? AttachmentUrls { get; set; }
}

public class UpdateBulletinDto : CreateBulletinDto
{
    public ContentStatus Status { get; set; }
}
```

### API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/bulletins` | `bulletins.read` | List bulletins (query: `locationId`, `type`, `status`, `page`, `pageSize`) |
| GET | `/bulletins/unread` | `bulletins.read` | Unread bulletins for the authenticated employee |
| GET | `/bulletins/{id}` | `bulletins.read` | Detail + `isReadByCurrentUser` flag |
| POST | `/bulletins` | `bulletins.create` | Create bulletin; triggers push notification |
| PUT | `/bulletins/{id}` | `bulletins.create` | Update content/status |
| DELETE | `/bulletins/{id}` | `bulletins.delete` | Archive (sets Status = Archived) |
| POST | `/bulletins/{id}/read` | `bulletins.read` | Mark as read by current user (idempotent) |
| GET | `/bulletins/{id}/reads` | `bulletins.create` | Who has read + timestamps (manager view) |

**Push notification trigger:** On `POST /bulletins` with `Status = Published`, send push to all employees at the bulletin's `LocationId` (or all company employees if company-wide).

### Web UI

**Route:** `/dashboard/bulletins`
**Sidebar:** Under "Field Communications" section, icon `campaign`

Screens:
- **List view** — table with columns: Title, Type (chip), Priority (color badge), Location, Published, Reads/Total, Actions
- **Create/Edit panel** — slide-over panel (not modal), rich text content field, location picker, expiry date, attachment URLs
- **Read tracking view** — inside detail panel: table of employee name + read timestamp; highlight employees who have not read

### Mobile UI

**Tab:** `(tabs)/bulletins.tsx` — tab icon `notifications` with unread badge count
**Detail:** `bulletins/[id].tsx` — mark as read automatically on screen mount

List screen layout:
```
┌─────────────────────────────────┐
│ [URGENT] Safety Reminder        │
│ ● All Locations · 2h ago        │
│ Tap to read ›                   │
├─────────────────────────────────┤
│ [HIGH] Holiday Schedule         │
│ ● Downtown · Yesterday          │
├─────────────────────────────────┤
│ [NORMAL] New Parking Policy     │
│ ● Company-wide · 3 days ago ✓   │
└─────────────────────────────────┘
```
✓ = already read; no check = unread.

### Kiosk

After clock-out success screen, check for unread **Urgent** bulletins for this employee. If any exist, show a full-screen card:
```
┌─────────────────────────────────┐
│  ⚠  Important Notice            │
│                                 │
│  [Bulletin Title]               │
│  [Content — max 3 lines]        │
│                                 │
│         [ Got It ]              │
└─────────────────────────────────┘
```
Tap "Got It" → `POST /bulletins/{id}/read` → next bulletin or dismiss. Maximum 3 bulletins shown per clock-out session.

---

## 2. Daily Reports

### Purpose

Replace paper-based site logs and email check-ins. A supervisor submits one report per location per day. The report auto-populates attendance from ShiftEvents. Supervisors add notes and photos; managers review and export.

### Data Models

```csharp
public class LocationDailyReport
{
    public Guid ReportId { get; set; }
    public string CompanyId { get; set; }
    public int LocationId { get; set; }
    public DateOnly ReportDate { get; set; }        // one per location per day
    public string? WeatherDataJson { get; set; }    // JSON string (WeatherSnapshot)
    public string? Notes { get; set; }
    public int TotalEmployees { get; set; }         // snapshot on Submit
    public decimal TotalHours { get; set; }         // snapshot on Submit
    public ReportStatus Status { get; set; }        // Draft | Submitted | Approved
    public int? SubmittedByPersonId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Location Location { get; set; }
    public ICollection<ReportMedia> Media { get; set; } = new List<ReportMedia>();
}

public class ReportMedia
{
    public Guid MediaId { get; set; }
    public Guid ReportId { get; set; }
    public int PersonId { get; set; }
    public Guid? ShiftEventId { get; set; }         // optional link to clock event
    public MediaType MediaType { get; set; }        // Photo | Note | Video
    public string MediaUrl { get; set; }            // S3 key
    public string? Caption { get; set; }
    public DateTime UploadedAt { get; set; }

    public LocationDailyReport Report { get; set; }
    public Person Person { get; set; }
}

public enum ReportStatus { Draft, Submitted, Approved }
public enum MediaType { Photo, Note, Video }
```

**WeatherSnapshot (deserialized from WeatherDataJson):**
```csharp
public record WeatherSnapshot(
    double Temperature,
    double FeelsLike,
    int Humidity,
    string Description,
    string Icon,           // OpenWeatherMap icon code e.g. "02d"
    double WindSpeed,
    DateTime FetchedAt
);
```

**DB constraint:** Unique index on `(CompanyId, LocationId, ReportDate)`.

### Weather Integration

On `GET /locations/{locationId}/daily-reports/{date}` for today's date:
1. Look up `Location.GeoCoordinates`
2. Call OpenWeatherMap `current weather` endpoint (API key from `OPENWEATHER_API_KEY` env var)
3. Store result as `WeatherDataJson` on the report
4. If weather fetch fails, continue — weather is non-blocking

**Endpoint:** `https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=imperial&appid={key}`

Weather is fetched **once** at report creation and never refreshed.

### Auto-Aggregation

`TotalEmployees` and `TotalHours` are computed dynamically from `ShiftEvents` for the report date and location when `Status = Draft`. On `Status → Submitted`, the values are snapshotted into the model as the official record.

### API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/locations/{locationId}/daily-reports` | `reports.view` | List reports for location (query: `startDate`, `endDate`, `status`) |
| GET | `/locations/{locationId}/daily-reports/{date}` | `reports.view` | Get or auto-create report for date (date format: `yyyy-MM-dd`) |
| PUT | `/locations/{locationId}/daily-reports/{id}` | `reports.create` | Update notes, submit (status transition) |
| POST | `/locations/{locationId}/daily-reports/{id}/media` | `reports.create` | Upload photo/note (multipart form-data) |
| DELETE | `/locations/{locationId}/daily-reports/{id}/media/{mediaId}` | `reports.create` | Remove media item |
| GET | `/locations/{locationId}/daily-reports/{id}/export` | `reports.export` | Generate PDF; returns `{ jobId, status }` then poll `GET /reports/export/{jobId}` |

### Web UI

**Route:** `/dashboard/daily-reports`
**Sidebar:** Under "Field Communications", icon `summarize`

Screens:
- **Location + date picker** — select location → date grid showing report status per day (color coded: Draft=grey, Submitted=blue, Approved=green)
- **Report detail** — weather widget, employee attendance table (from ShiftEvents), hours total, photo gallery, notes field, Submit/Approve actions, Export PDF button

### Mobile UI

**Tab:** `(tabs)/daily-report.tsx` — only visible to users with `reports.create` permission

Screen layout:
```
┌─────────────────────────────────┐
│  📍 Downtown Office · Apr 22    │
│  ☀ 72°F  Partly cloudy          │
├─────────────────────────────────┤
│  👥 8 employees  ·  62.5 hrs    │
│  [View Attendance]              │
├─────────────────────────────────┤
│  Photos                [+ Add]  │
│  [photo] [photo] [photo]        │
├─────────────────────────────────┤
│  Notes                          │
│  ┌───────────────────────────┐  │
│  │ Tap to add notes...       │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│        [ Submit Report ]        │
└─────────────────────────────────┘
```

Photo upload: tap `+ Add` → bottom sheet with Camera / Photo Library options → upload to S3 via presigned URL pattern.

---

## 3. Documents

### Purpose

A structured, searchable library of operational reference documents (manuals, procedures, SDS sheets, floor plans, policies). Documents are generally open to employees but support per-document access control for sensitive materials.

### Access Level Model

```
AccessLevel.Public      → all employees in the company
AccessLevel.LocationOnly → employees assigned to the document's LocationId
AccessLevel.Restricted  → employees whose RoleId is in AllowedRoleIds
```

The API enforces this filter on `GET /documents` — employees never see documents outside their access level. No client-side filtering.

### Data Models

```csharp
public class Document
{
    public Guid DocumentId { get; set; }
    public string CompanyId { get; set; }
    public int? LocationId { get; set; }             // null = company-wide
    public string Title { get; set; }
    public string? Description { get; set; }
    public DocumentType Type { get; set; }
    // Manual | Procedure | SafetyDataSheet | ProductInfo | FloorPlan | Policy | Other
    public string FileUrl { get; set; }              // S3 key (not pre-signed)
    public long FileSize { get; set; }               // bytes
    public string MimeType { get; set; }             // e.g. "application/pdf"
    public string Version { get; set; }              // e.g. "1.0", "2.3"
    public List<string> Tags { get; set; } = new(); // JSON in DB
    public DocumentAccessLevel AccessLevel { get; set; } // Public | LocationOnly | Restricted
    public List<Guid> AllowedRoleIds { get; set; } = new(); // JSON; only for Restricted
    public int UploadedByPersonId { get; set; }
    public ContentStatus Status { get; set; }        // Active | Archived
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Person UploadedBy { get; set; }
    public Location? Location { get; set; }
    public ICollection<DocumentReadLog> ReadLogs { get; set; } = new List<DocumentReadLog>();
}

public class DocumentReadLog
{
    public Guid LogId { get; set; }
    public Guid DocumentId { get; set; }
    public int PersonId { get; set; }
    public DateTime ReadAt { get; set; }

    public Document Document { get; set; }
    public Person Person { get; set; }
}

public enum DocumentType
{
    Manual, Procedure, SafetyDataSheet, ProductInfo, FloorPlan, Policy, Other
}

public enum DocumentAccessLevel { Public, LocationOnly, Restricted }
```

### DTOs

```csharp
public class DocumentDto
{
    public Guid DocumentId { get; set; }
    public string Title { get; set; }
    public string? Description { get; set; }
    public string Type { get; set; }
    public string MimeType { get; set; }
    public long FileSize { get; set; }
    public string Version { get; set; }
    public List<string> Tags { get; set; }
    public string AccessLevel { get; set; }
    public int? LocationId { get; set; }
    public string Status { get; set; }
    public string UploadedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    // FileUrl is NOT included here — returned only via GET /documents/{id}
}

public class DocumentDetailDto : DocumentDto
{
    public string PresignedUrl { get; set; }    // 15-min expiry S3 pre-signed URL
    public int TotalReads { get; set; }
}

public class UploadDocumentDto
{
    public string Title { get; set; }
    public string? Description { get; set; }
    public DocumentType Type { get; set; }
    public int? LocationId { get; set; }
    public string Version { get; set; }
    public List<string>? Tags { get; set; }
    public DocumentAccessLevel AccessLevel { get; set; }
    public List<Guid>? AllowedRoleIds { get; set; }
    public string FileName { get; set; }        // used to generate S3 key
    public string MimeType { get; set; }
    public long FileSize { get; set; }
}

public class UploadDocumentResponseDto
{
    public Guid DocumentId { get; set; }
    public string PresignedUploadUrl { get; set; }  // PUT to this URL with the file
    public string S3Key { get; set; }
}
```

### Upload Flow

```
1. Client POST /documents (metadata only) → API creates Document record (Status=Draft), generates S3 presigned PUT URL
2. Client PUT presignedUploadUrl (raw file bytes, Content-Type header)
3. Client PATCH /documents/{id}/confirm → API sets Status=Active
```

This keeps large files off the API server entirely.

### API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/documents` | `documents.read` | List (filtered by caller's access level). Query: `locationId`, `type`, `tag`, `search`, `page` |
| GET | `/documents/{id}` | `documents.read` | Detail + pre-signed download URL (logs read event) |
| POST | `/documents` | `documents.upload` | Create metadata + get presigned upload URL |
| PATCH | `/documents/{id}/confirm` | `documents.upload` | Mark Active after successful S3 upload |
| PUT | `/documents/{id}` | `documents.upload` | Update metadata/version/access |
| DELETE | `/documents/{id}` | `documents.delete` | Archive |
| GET | `/documents/{id}/read-logs` | `documents.view-logs` | Compliance: who opened it + timestamps |

### Web UI

**Route:** `/dashboard/documents`
**Sidebar:** Under "Resources" section, icon `folder_open`

Screens:
- **Library grid** — filter bar (Type chips, Location dropdown, search). Card layout: type icon, title, version badge, file size, last updated.
- **Upload panel** — drag-and-drop zone, metadata form (title, type, location, version, access level, tags)
- **Detail panel** — preview (iframe for PDF), read log table, version history

### Mobile UI

**Tab:** `(tabs)/documents.tsx`

Category tile layout (large icons, easy to tap):
```
┌───────────┐  ┌───────────┐  ┌───────────┐
│   📋      │  │   🔧      │  │   ⚗️      │
│  Manuals  │  │ Procedures│  │    SDS    │
│   (4)     │  │   (7)     │  │   (12)   │
└───────────┘  └───────────┘  └───────────┘
┌───────────┐  ┌───────────┐  ┌───────────┐
│   🗺️      │  │   📄      │  │   📁      │
│ Floor     │  │ Policies  │  │   Other   │
│  Plans    │  │   (3)     │  │   (2)     │
└───────────┘  └───────────┘  └───────────┘
```

Document detail screen: in-app PDF viewer (`react-native-pdf`). File cached locally via `expo-file-system` after first open. Cache key = `documentId + version` (invalidates on version change).

---

## 4. Safety

### Purpose

Distribute and track mandatory safety content — toolbox talks, orientations, instructional videos, SDS sheets. Unlike Documents (open library), Safety content is **pushed to employees** and requires explicit acknowledgment. Supervisors see exactly who is compliant.

### Key Distinction from Documents

| | Documents | Safety |
|---|---|---|
| Discovery | Employee browses | Supervisor assigns / schedules |
| Access | Open (with filters) | Explicit push distribution |
| Completion | Optional read log | Mandatory acknowledgment |
| Supervisor view | Who opened what | Who is complete vs pending |
| Compliance tracking | Lightweight | Strict (required for audits) |

### Data Models

```csharp
public class SafetyContent
{
    public Guid SafetyContentId { get; set; }
    public string CompanyId { get; set; }
    public int? LocationId { get; set; }                   // null = company-wide
    public string Title { get; set; }
    public string Description { get; set; }
    public SafetyContentType Type { get; set; }
    // ToolboxTalk | SafetyDataSheet | Orientation | InstructionalVideo | Training
    public string? ContentUrl { get; set; }                // S3 key (PDF or video)
    public string? TextContent { get; set; }               // inline text for talks
    public string? ThumbnailUrl { get; set; }              // S3 key
    public int? DurationMinutes { get; set; }              // for videos
    public bool IsAcknowledgmentRequired { get; set; }     // true for Orientation/ToolboxTalk
    public DateTime? ScheduledFor { get; set; }            // triggers push at this time
    public List<string> Tags { get; set; } = new();
    public int CreatedByPersonId { get; set; }
    public ContentStatus Status { get; set; }              // Draft | Published | Archived
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Person CreatedBy { get; set; }
    public Location? Location { get; set; }
    public ICollection<SafetyAcknowledgment> Acknowledgments { get; set; }
}

public class SafetyAcknowledgment
{
    public Guid AcknowledgmentId { get; set; }
    public Guid SafetyContentId { get; set; }
    public int PersonId { get; set; }
    public DateTime AcknowledgedAt { get; set; }
    public string? Notes { get; set; }

    public SafetyContent SafetyContent { get; set; }
    public Person Person { get; set; }
}

public enum SafetyContentType
{
    ToolboxTalk, SafetyDataSheet, Orientation, InstructionalVideo, Training
}
```

**DB constraint:** Unique index on `(SafetyContentId, PersonId)` in `SafetyAcknowledgment`.

### Acknowledgment Compliance Response

`GET /safety/{id}/acknowledgments` returns:
```json
{
  "totalAssigned": 12,
  "totalCompleted": 8,
  "completionRate": 0.667,
  "completed": [
    { "personId": 1, "name": "Alice Smith", "acknowledgedAt": "2026-04-22T08:30:00Z" }
  ],
  "pending": [
    { "personId": 5, "name": "Bob Jones" }
  ]
}
```

"Assigned" = all active employees at the content's location (or all company employees if company-wide).

### API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/safety` | `safety.read` | List (query: `type`, `locationId`, `status`) |
| GET | `/safety/{id}` | `safety.read` | Detail + caller's acknowledgment status |
| POST | `/safety` | `safety.create` | Create; if `ScheduledFor` set, schedule push notification job |
| PUT | `/safety/{id}` | `safety.create` | Update |
| DELETE | `/safety/{id}` | `safety.delete` | Archive |
| POST | `/safety/{id}/acknowledge` | `safety.acknowledge` | Employee signs off (idempotent) |
| GET | `/safety/{id}/acknowledgments` | `safety.track` | Completed vs pending employee lists |
| GET | `/people/{personId}/safety/pending` | `safety.read` | All pending required acknowledgments for an employee |

**Push notification trigger:** On `POST /safety` with `ScheduledFor` set, register a background job that fires at that datetime and sends push to all eligible employees.

### Web UI

**Route:** `/dashboard/safety`
**Sidebar:** Under "Resources" section, icon `health_and_safety`

Screens:
- **Content library** — list with type filter, status filter. Shows completion rate progress bar per item.
- **Create screen** — type selector, text editor (for ToolboxTalk), file upload (for PDF/video), schedule picker, `IsAcknowledgmentRequired` toggle.
- **Detail / Compliance view** — content preview + two-column table: Completed (green) vs Pending (orange). Export compliance list as CSV.

### Mobile UI

**Tab:** `(tabs)/safety.tsx`

Two sections:
1. **Required** (top) — items with `IsAcknowledgmentRequired = true` and no acknowledgment yet. Red badge count on tab.
2. **Library** (below) — all published safety content, browsable.

Acknowledgment screen (`safety/[id].tsx`):
```
┌─────────────────────────────────┐
│  🦺 Toolbox Talk                 │
│  Fall Protection on Rooftops    │
│                                 │
│  [Content / PDF / Video]        │
│                                 │
│  [Optional: Add a note...]      │
│                                 │
│    [ I Acknowledge This ]       │
└─────────────────────────────────┘
```

Button is disabled until content is fully scrolled (for text/PDF) or video played to 80%.

### Kiosk

After clock-out, check for pending **required** safety acknowledgments for the employee. Show one at a time using the same interstitial card pattern as bulletins. This ensures employees without phones can still complete acknowledgments.

---

## Shared Enums

Add to a shared `Enums.cs` file or within each model file:

```csharp
public enum ContentStatus { Draft, Published, Archived }
```

---

## New Permissions — Seed in `PermissionSeedService.cs`

```csharp
// Bulletins
{ Key = "bulletins.create",       Description = "Create and edit bulletins" },
{ Key = "bulletins.read",         Description = "View bulletins" },
{ Key = "bulletins.delete",       Description = "Archive bulletins" },
{ Key = "bulletins.track-reads",  Description = "View who has read a bulletin" },

// Daily Reports
{ Key = "reports.create",  Description = "Create and submit daily reports" },
{ Key = "reports.view",    Description = "View daily reports" },
{ Key = "reports.export",  Description = "Export daily reports to PDF" },
{ Key = "reports.approve", Description = "Approve submitted daily reports" },

// Documents
{ Key = "documents.upload",     Description = "Upload new documents" },
{ Key = "documents.read",       Description = "View and download documents" },
{ Key = "documents.delete",     Description = "Archive documents" },
{ Key = "documents.view-logs",  Description = "View document read compliance logs" },
{ Key = "documents.manage-access", Description = "Set document access level and allowed roles" },

// Safety
{ Key = "safety.create",      Description = "Create safety content" },
{ Key = "safety.read",        Description = "View safety content" },
{ Key = "safety.delete",      Description = "Archive safety content" },
{ Key = "safety.acknowledge", Description = "Acknowledge safety content as an employee" },
{ Key = "safety.track",       Description = "Track employee acknowledgment compliance" },
```

### Default Role Assignments — Update `RoleSeedService.cs`

| Permission | Admin | Manager | Supervisor | Employee |
|---|---|---|---|---|
| bulletins.create | ✓ | ✓ | — | — |
| bulletins.read | ✓ | ✓ | ✓ | ✓ |
| bulletins.delete | ✓ | ✓ | — | — |
| bulletins.track-reads | ✓ | ✓ | ✓ | — |
| reports.create | ✓ | ✓ | ✓ | — |
| reports.view | ✓ | ✓ | ✓ | ✓ |
| reports.export | ✓ | ✓ | — | — |
| reports.approve | ✓ | ✓ | — | — |
| documents.upload | ✓ | ✓ | — | — |
| documents.read | ✓ | ✓ | ✓ | ✓ |
| documents.delete | ✓ | ✓ | — | — |
| documents.view-logs | ✓ | ✓ | — | — |
| documents.manage-access | ✓ | ✓ | — | — |
| safety.create | ✓ | ✓ | — | — |
| safety.read | ✓ | ✓ | ✓ | ✓ |
| safety.delete | ✓ | ✓ | — | — |
| safety.acknowledge | — | — | ✓ | ✓ |
| safety.track | ✓ | ✓ | ✓ | — |

---

## DbContext Changes — `ShiftWorkContext.cs`

Add the following `DbSet` declarations:

```csharp
public DbSet<Bulletin> Bulletins { get; set; }
public DbSet<BulletinRead> BulletinReads { get; set; }
public DbSet<LocationDailyReport> LocationDailyReports { get; set; }
public DbSet<ReportMedia> ReportMedia { get; set; }
public DbSet<Document> Documents { get; set; }
public DbSet<DocumentReadLog> DocumentReadLogs { get; set; }
public DbSet<SafetyContent> SafetyContents { get; set; }
public DbSet<SafetyAcknowledgment> SafetyAcknowledgments { get; set; }
```

Add fluent API configuration in `OnModelCreating`:

```csharp
// Bulletin unique read constraint
modelBuilder.Entity<BulletinRead>()
    .HasIndex(r => new { r.BulletinId, r.PersonId })
    .IsUnique();

// Daily report unique per location per day
modelBuilder.Entity<LocationDailyReport>()
    .HasIndex(r => new { r.CompanyId, r.LocationId, r.ReportDate })
    .IsUnique();

// Safety acknowledgment unique per person
modelBuilder.Entity<SafetyAcknowledgment>()
    .HasIndex(a => new { a.SafetyContentId, a.PersonId })
    .IsUnique();

// JSON column mappings (EF Core 8)
modelBuilder.Entity<Bulletin>()
    .Property(b => b.AttachmentUrls)
    .HasConversion(
        v => JsonSerializer.Serialize(v, default(JsonSerializerOptions)),
        v => JsonSerializer.Deserialize<List<string>>(v, default(JsonSerializerOptions)) ?? new()
    );
// Apply same pattern for Document.Tags, Document.AllowedRoleIds, SafetyContent.Tags
```

---

## New Environment Variable

```
OPENWEATHER_API_KEY=<key from openweathermap.org free tier>
```

Add to `.env.example` and `Program.cs` configuration reading.

---

## Technical Debt Log

| Item | Severity | Milestone |
|---|---|---|
| `Document.AllowedRoleIds` as JSON array — no join table | Low | v2 acceptable; move to `DocumentRoleAccess` table at >500 docs or >20 roles |
| PDF export is synchronous placeholder in v2 | Medium | v2: return 501 Not Implemented; implement async job in v2.1 |
| Video hosting via raw S3 | Medium | Add CloudFront CDN for media in v2.1 |
| Safety push scheduling is in-process | Medium | Move to background job queue (Hangfire or similar) in v2.1 |
| Full-text document search uses SQL LIKE | Low | Acceptable for <1000 docs; plan Elasticsearch/Azure Search for scale |
