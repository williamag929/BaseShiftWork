# ShiftWork — Claude Code Project Guide

> AI-first documentation for Claude Code and agent-based workflows. Read this before touching any file.

## Project Identity

ShiftWork is a **multi-tenant workforce management platform** for field operations industries (security, facilities, construction, janitorial). It is purpose-built for **non-desk workers** — the UX principle is: *assistant-grade simplicity, not documentation-grade complexity*.

Three client surfaces share one API:
| Surface | Stack | Audience |
|---|---|---|
| `ShiftWork.Angular` | Angular 19 + NgRx + Material | Managers / Admins (web) |
| `ShiftWork.Mobile` | React Native + Expo + Zustand | Employees (phone) |
| `ShiftWork.Kiosk` | React Native + Expo | Clock-in terminal (tablet) |
| `ShiftWork.Api` | .NET 8 + EF Core + SQL Server | Backend (REST) |

---

## Architecture at a Glance

```
[Angular Web]  [Mobile RN]  [Kiosk RN]
       │              │            │
       └──────────────┴────────────┘
                      │
              REST API (.NET 8)
                      │
           ┌──────────┼──────────┐
        SQL Server   AWS S3   Expo Push
```

**Multi-tenancy:** Every resource is scoped by `CompanyId`. Always include it in queries and DTOs.

**Auth:**
- Web/Admin → Firebase JWT (Bearer token from Firebase)
- Mobile/Employee → API JWT issued by `POST /api/auth/login` or `POST /api/auth/accept-invite`
- Kiosk → PIN verification (`POST /api/auth/verify-pin`), no persistent session

**Authorization:** Custom `PermissionAuthorizationHandler` evaluates `[Authorize(Policy = "permission.key")]` against `CompanyUser → UserRole → Role → RolePermission → Permission` chain.

---

## Codebase Conventions

### Backend (.NET)

- **Controllers** → thin, delegate to Services. No business logic in controllers.
- **Services** → all business logic. One service per aggregate (e.g., `BulletinService`, `DocumentService`).
- **DTOs** → separate Input DTOs (Create/Update) from Output DTOs. Never expose EF models directly.
- **AutoMapper** → all model↔DTO mapping in `Helpers/AutoMapperProfile.cs`.
- **EF Core** → `ShiftWorkContext.cs`. Add `DbSet<T>` for every new model. Migrations via `dotnet ef`.
- **Audit** → `AuditInterceptor` automatically logs all Create/Update/Delete to `AuditHistory`. No manual logging needed for CRUD.
- **Permissions** → seed new permission keys in `PermissionSeedService.cs`. Follow naming: `resource.action` (e.g., `bulletins.create`).
- **S3 uploads** → use `AwsS3Service`. Never store files in the database.
- **Push notifications** → use `PushNotificationService` (Expo Push API). Send after state changes.

### Angular (Web)

- **Feature modules** live in `src/app/features/dashboard/`. Add new features here.
- **Services** in `src/app/core/services/`. One Angular service per API resource.
- **State** → NgRx for global state. Local component state for UI-only concerns.
- **Navigation** → add new routes to `dashboard-routing.module.ts`. Add nav links to `dashboard.component.html`.
- **Sidebar sections:** Main Menu → Management → PTO → Kiosks → **Field Communications** → **Resources** → More Options.
- **Material Icons** → use Google Material icons in `<mat-icon>`. No custom SVGs unless necessary.

### Mobile (React Native / Expo)

- **Routes** → Expo Router file-based. Tabs go in `app/(tabs)/`. Modals/detail screens in `app/<feature>/[id].tsx`.
- **State** → Zustand (`store/authStore.ts`) for auth. TanStack React Query for server state.
- **Services** → Axios-based clients in `services/`. One file per API resource.
- **Offline** → cache document metadata in Expo SQLite. Cache files via `expo-file-system`.
- **Uploads** → use `upload.service.ts` pattern (presigned S3 URL → direct upload). Never POST files through the API.
- **Push** → register device token on login via `notification.service.ts`.

### Kiosk (React Native / Expo)

- Keep flows **minimal**. Only add kiosk steps for time-critical or safety-critical information.
- Kiosk has no persistent user session — each action is stateless after clock-out.
- Post-clock-out interstitials are acceptable for urgent bulletins and required safety acknowledgments only.

---

## Key File Locations

| What | Where |
|---|---|
| EF Models | `ShiftWork.Api/Models/` |
| API Controllers | `ShiftWork.Api/Controllers/` |
| Business Services | `ShiftWork.Api/Services/` |
| DTOs | `ShiftWork.Api/DTOs/` |
| DB Context | `ShiftWork.Api/Data/ShiftWorkContext.cs` |
| AutoMapper Profile | `ShiftWork.Api/Helpers/AutoMapperProfile.cs` |
| Permission Seed | `ShiftWork.Api/Services/PermissionSeedService.cs` |
| Role Seed | `ShiftWork.Api/Services/RoleSeedService.cs` |
| EF Migrations | `ShiftWork.Api/Migrations/` |
| Angular Features | `ShiftWork.Angular/src/app/features/dashboard/` |
| Angular Services | `ShiftWork.Angular/src/app/core/services/` |
| Angular Routing | `ShiftWork.Angular/src/app/features/dashboard/dashboard-routing.module.ts` |
| Angular Sidebar | `ShiftWork.Angular/src/app/features/dashboard/dashboard.component.html` |
| Mobile Tabs | `ShiftWork.Mobile/app/(tabs)/` |
| Mobile Services | `ShiftWork.Mobile/services/` |
| Mobile Auth Store | `ShiftWork.Mobile/store/authStore.ts` |
| Kiosk Screens | `ShiftWork.Kiosk/app/(kiosk)/` |

---

## Active Development Branch

**Branch:** `feature/v2-content-communication`
**Milestone:** Version 2.0 — Content & Communication Subsystem

### New Modules in This Release

| Module | Description | Spec |
|---|---|---|
| Bulletins | Manager posts → employee reads with acknowledgment | `Docs/V2_CONTENT_COMMUNICATION_SPEC.md#bulletins` |
| Daily Reports | Location-based daily report with weather, hours, photos | `Docs/V2_CONTENT_COMMUNICATION_SPEC.md#daily-reports` |
| Documents | Role-filtered document library (manuals, SDS, plans) | `Docs/V2_CONTENT_COMMUNICATION_SPEC.md#documents` |
| Safety | Supervisor-controlled content with mandatory acknowledgment | `Docs/V2_CONTENT_COMMUNICATION_SPEC.md#safety` |

**Full spec:** `Docs/V2_CONTENT_COMMUNICATION_SPEC.md`
**Implementation order:** `Docs/V2_IMPLEMENTATION_GUIDE.md`

---

## UX Design Principles (Non-Negotiable)

1. **One primary action per screen** — every screen has one CTA button.
2. **Auto-populate from existing data** — reports pre-fill from ShiftEvents; weather auto-fetches.
3. **Touch-first** — all interactive targets ≥ 48×48 dp.
4. **Unread counts** — tab badge numbers for bulletins and pending safety.
5. **Offline-capable** — document metadata cached locally; files cached on first open.
6. **No redundant input** — employees should never type what the system already knows.
7. **Push notifications** for all time-sensitive content (new bulletin, scheduled safety).

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `DB_CONNECTION_STRING` | API | SQL Server connection |
| `FIREBASE_PROJECT_ID` | API, Angular | Firebase project |
| `FIREBASE_API_KEY` | API, Angular | Firebase web key |
| `AWS_REGION` | API | S3 bucket region |
| `Smtp:Host/Port/Username/From` | API | Email notifications |
| `EXPO_PUSH_API_URL` | API | Expo push endpoint |
| `OPENWEATHER_API_KEY` | API | Weather for daily reports (v2 new) |
| `API_URL` | Angular, Mobile | Backend base URL |

---

## Running Locally

```bash
# API
cd ShiftWork.Api
dotnet restore && dotnet run

# Angular
cd ShiftWork.Angular
npm install && npm run start

# Mobile
cd ShiftWork.Mobile
npx expo start

# Kiosk
cd ShiftWork.Kiosk
npx expo start
```

---

## Do Not

- Do not expose EF models directly in API responses — always use DTOs.
- Do not add business logic to controllers.
- Do not hardcode `CompanyId` — always derive from auth context or route parameter.
- Do not bypass `PermissionAuthorizationHandler` — use `[Authorize(Policy = "...")]`.
- Do not store uploaded files in the database — use S3 via `AwsS3Service`.
- Do not add heavy modals or multi-step forms to the Kiosk — keep it one-tap.
- Do not add comments that describe *what* code does — only add comments for non-obvious *why*.
