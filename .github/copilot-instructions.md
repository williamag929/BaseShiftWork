# Copilot Instructions — ShiftWork

## Big picture architecture
- Monorepo with three primary apps: ASP.NET Core API in ShiftWork.Api, Angular web/kiosk in ShiftWork.Angular, and React Native/Expo mobile in ShiftWork.Mobile. A separate Python MCP utility lives in python_client.
- Core workflow: clock in/out and kiosk answers flow through the API. Kiosk UI calls `GET /api/kiosk/{companyId}/questions` and `POST /api/kiosk/answers`, then creates ShiftEvent records via `POST /api/companies/{companyId}/shiftevents` (see [AGENT.md](AGENT.md)).
- API uses EF Core with DTOs and AutoMapper; controllers in ShiftWork.Api/Controllers call services in ShiftWork.Api/Services (see [README.md](README.md)).
- Photo uploads use AWS S3; auth is Firebase JWT (API validates Firebase tokens; see [AGENT.md](AGENT.md)).

## Developer workflows (Windows)
- API: set env vars (`DB_CONNECTION_STRING`, Firebase vars) then `dotnet restore`, `dotnet build`, `dotnet run` in ShiftWork.Api (see [AGENT.md](AGENT.md)).
- Angular: `npm install`, `npm run start` in ShiftWork.Angular; camera + Wake Lock require HTTPS and a local cert (see [ShiftWork.Angular/README.md](ShiftWork.Angular/README.md)).
- Mobile: `npm install --legacy-peer-deps`, copy `.env.example` to `.env`, then `npm start` in ShiftWork.Mobile (see [ShiftWork.Mobile/README.md](ShiftWork.Mobile/README.md)).
- Python MCP server: from python_client, install requirements and run `python http_mcp_server.py --mode http --port 8080` (see [AGENT.md](AGENT.md)).

## Project-specific conventions and patterns
- Company-scoped APIs consistently use `/api/companies/{companyId}/...` routes; prefer mirroring this in new endpoints and clients.
- Kiosk flow expects optional PIN verification via `POST /api/auth/verify-pin` before writing ShiftEvents (see [AGENT.md](AGENT.md)).
- DTOs may map between model string IDs and int DTO IDs via AutoMapper (see “ScheduleDto.PersonId” note in [AGENT.md](AGENT.md)).
- Angular kiosk uses Wake Lock and camera; ensure HTTPS in local dev and avoid caching POSTs in PWA (see [ShiftWork.Angular/README.md](ShiftWork.Angular/README.md)).

## Integrations and cross-component details
- API auth: Firebase JWT audience/issuer; Angular reads API/Firebase config from env-injected variables (see [AGENT.md](AGENT.md)).
- Mobile uses `EXPO_PUBLIC_` env var prefix and currently has Firebase Auth disabled with a mock in `config/firebase.ts` (see Known Issues in [ShiftWork.Mobile/README.md](ShiftWork.Mobile/README.md)).
- Notification channels (SMTP/Twilio/push simulated) are configured via appsettings/env; see Notification Service section in [AGENT.md](AGENT.md).

## Reference files and entry points
- API entry: ShiftWork.Api/Program.cs; REST examples in ShiftWork.Api/ShiftWork.Api.http.
- Angular entry: ShiftWork.Angular/src/main.ts and routes in ShiftWork.Angular/src/app.
- Mobile entry: ShiftWork.Mobile/app (Expo Router) with services in ShiftWork.Mobile/services.
- MCP utilities: python_client/http_mcp_server.py and python_client/README.txt.
