# MCP Tools Build Guide — ShiftWork Python Client

> **Purpose:** This document is the authoritative specification for expanding the MCP tool catalogue in `http_mcp_server.py`.  
> **Target file:** `python_client/http_mcp_server.py`  
> **Current tool count:** 4 (ping, get_company_info, get_employee_schedules, get_people_with_unpublished_schedules)  
> **Target tool count after this guide:** 28  

---

## 1. Architecture Overview

```
[AI Agent / LLM Client]
        │  MCP protocol (stdio) or HTTP POST /api/tools/execute
        ▼
[ShiftWorkServer  — http_mcp_server.py]
        │  httpx GET / POST / PATCH / DELETE
        ▼
[ShiftWork.Api  — ASP.NET Core, :5182]
        │  EF Core
        ▼
[SQL Server]
```

**Key invariants to maintain:**
- Every tool has both a **MCP registration** (`list_tools` → `Tool(...)`) and an **implementation method** (`_<name>_impl(arguments)`).
- Every tool has a matching **HTTP REST route** in `_setup_http_routes()`.
- All `_impl` methods raise `ValueError` for bad inputs and `RuntimeError` for API/network failures — never expose raw exceptions to callers.
- Auth (`MCP_AUTH_TOKEN`) is enforced by the existing middleware on all `/api/*` routes — no extra work needed per-tool.
- Required `company_id` is always the first-level route segment: `api/companies/{company_id}/...`

---

## 2. Complete API Endpoint Inventory

All endpoints that need MCP tool coverage, discovered by reading the .NET controllers.

### 2.1 Auth / User (`/api/auth`)

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/auth/user/{email}` | No | Get person by email |
| `GET` | `/api/auth/user` | Yes (JWT) | Get current user from token |
| `POST` | `/api/auth/verify-pin` | No | Verify a person's BCrypt PIN |
| `POST` | `/api/auth/register` | Yes (Firebase JWT) | Register new company + admin user |

### 2.2 Companies (`/api/companies`)

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/companies` | No | List all companies |
| `GET` | `/api/companies/{id}` | Yes | Get company by ID |
| `POST` | `/api/companies` | Yes | Create company |
| `PUT` | `/api/companies/{id}` | Yes | Update company |
| `PATCH` | `/api/companies/{id}/onboarding-status` | Yes | Update onboarding status |
| `POST` | `/api/companies/{id}/plan/upgrade` | Yes | Upgrade plan (Stripe stub) |

### 2.3 Company Settings (`/api/companies/{id}/settings`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/settings` | Get kiosk settings |
| `PUT` | `/api/companies/{id}/settings` | Update settings |

### 2.4 People (`/api/companies/{companyId}/people`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/people` | List all people (paginated, searchable) |
| `GET` | `/api/companies/{id}/people/{personId}` | Get single person |
| `POST` | `/api/companies/{id}/people` | Create person |
| `PUT` | `/api/companies/{id}/people/{personId}` | Update person |
| `PATCH` | `/api/companies/{id}/people/{personId}/status` | Update person status |
| `DELETE` | `/api/companies/{id}/people/{personId}` | Delete person |
| `GET` | `/api/companies/{id}/people/unpublished-schedules` | People with unpublished schedules |
| `GET` | `/api/companies/{id}/people/{personId}/shift-summary` | Shift summary for person |

### 2.5 Locations (`/api/companies/{companyId}/locations`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/locations` | List locations |
| `GET` | `/api/companies/{id}/locations/{locationId}` | Get location |
| `POST` | `/api/companies/{id}/locations` | Create location |
| `PUT` | `/api/companies/{id}/locations/{locationId}` | Update location |
| `DELETE` | `/api/companies/{id}/locations/{locationId}` | Delete location |

### 2.6 Areas (`/api/companies/{companyId}/areas`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/areas` | List areas |
| `GET` | `/api/companies/{id}/areas/{areaId}` | Get area |
| `POST` | `/api/companies/{id}/areas` | Create area |
| `PUT` | `/api/companies/{id}/areas/{areaId}` | Update area |
| `DELETE` | `/api/companies/{id}/areas/{areaId}` | Delete area |

### 2.7 Schedules (`/api/companies/{companyId}/schedules`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/schedules` | List all schedules |
| `GET` | `/api/companies/{id}/schedules/paged` | Paged + filtered schedules |
| `GET` | `/api/companies/{id}/schedules/{scheduleId}` | Get single schedule |
| `POST` | `/api/companies/{id}/schedules` | Create schedule |
| `PUT` | `/api/companies/{id}/schedules/{scheduleId}` | Update schedule |
| `DELETE` | `/api/companies/{id}/schedules/{scheduleId}` | Delete schedule |
| `POST` | `/api/companies/{id}/schedules/{id}/publish` | Publish schedule |

### 2.8 Shift Events (`/api/companies/{companyId}/shiftevents`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/shiftevents` | List all shift events for company |
| `GET` | `/api/companies/{id}/shiftevents/{eventLogId}` | Get specific shift event |
| `GET` | `/api/companies/{id}/shiftevents/person/{personId}` | Shift events for person |
| `POST` | `/api/companies/{id}/shiftevents` | Create shift event (clock-in/out) |

### 2.9 Kiosk (`/api/kiosk`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/kiosk/{companyId}/questions` | None | Get kiosk questions |
| `POST` | `/api/kiosk/answers` | None | Submit kiosk answers |
| `POST` | `/api/kiosk/{companyId}/verify-admin-password` | Yes | Verify kiosk admin password |

### 2.10 Sandbox (`/api/companies/{companyId}/sandbox`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/sandbox/status` | Count sandbox records |
| `POST` | `/api/companies/{id}/sandbox/hide` | Hide sandbox data |
| `POST` | `/api/companies/{id}/sandbox/reset` | Delete + re-seed sandbox |
| `POST` | `/api/companies/{id}/sandbox/delete` | Permanently delete sandbox (Pro/Trial only) |

### 2.11 Crews (`/api/companies/{companyId}/crews`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/crews` | List crews |
| `GET` | `/api/companies/{id}/crews/{crewId}` | Get crew |
| `POST` | `/api/companies/{id}/crews` | Create crew |

### 2.12 Roles & Permissions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies/{id}/roles` | List roles |
| `GET` | `/api/companies/{id}/permissions` | List permissions |

---

## 3. Tool Catalogue (28 Tools)

### Priority 1 — Core Operations (implement first)

These cover the most common agent workflows.

| # | Tool Name | API Call | Status |
|---|-----------|----------|--------|
| 1 | `ping` | none | ✅ exists |
| 2 | `get_company_info` | `GET /api/companies/{id}` | ✅ exists |
| 3 | `get_employee_schedules` | `GET /api/companies/{id}/schedules` (client-filtered) | ✅ exists |
| 4 | `get_people_with_unpublished_schedules` | `GET /api/companies/{id}/people/unpublished-schedules` | ✅ exists |
| 5 | `list_people` | `GET /api/companies/{id}/people` | ❌ build |
| 6 | `get_person` | `GET /api/companies/{id}/people/{personId}` | ❌ build |
| 7 | `list_locations` | `GET /api/companies/{id}/locations` | ❌ build |
| 8 | `list_areas` | `GET /api/companies/{id}/areas` | ❌ build |
| 9 | `get_shift_events_for_person` | `GET /api/companies/{id}/shiftevents/person/{personId}` | ❌ build |
| 10 | `create_shift_event` | `POST /api/companies/{id}/shiftevents` | ❌ build |
| 11 | `get_schedules_paged` | `GET /api/companies/{id}/schedules/paged` | ❌ build |

### Priority 2 — Administrative Tools

| # | Tool Name | API Call | Status |
|---|-----------|----------|--------|
| 12 | `create_person` | `POST /api/companies/{id}/people` | ❌ build |
| 13 | `update_person_status` | `PATCH /api/companies/{id}/people/{personId}/status` | ❌ build |
| 14 | `get_user_by_email` | `GET /api/auth/user/{email}` | ❌ build |
| 15 | `verify_pin` | `POST /api/auth/verify-pin` | ❌ build |
| 16 | `list_crews` | `GET /api/companies/{id}/crews` | ❌ build |
| 17 | `list_roles` | `GET /api/companies/{id}/roles` | ❌ build |
| 18 | `get_company_settings` | `GET /api/companies/{id}/settings` | ❌ build |

### Priority 3 — Kiosk & Onboarding

| # | Tool Name | API Call | Status |
|---|-----------|----------|--------|
| 19 | `get_kiosk_questions` | `GET /api/kiosk/{companyId}/questions` | ❌ build |
| 20 | `post_kiosk_answers` | `POST /api/kiosk/answers` | ❌ build |
| 21 | `get_sandbox_status` | `GET /api/companies/{id}/sandbox/status` | ❌ build |
| 22 | `hide_sandbox_data` | `POST /api/companies/{id}/sandbox/hide` | ❌ build |
| 23 | `reset_sandbox_data` | `POST /api/companies/{id}/sandbox/reset` | ❌ build |
| 24 | `delete_sandbox_data` | `POST /api/companies/{id}/sandbox/delete` | ❌ build |

### Priority 4 — Schedule Write Operations

| # | Tool Name | API Call | Status |
|---|-----------|----------|--------|
| 25 | `create_schedule` | `POST /api/companies/{id}/schedules` | ❌ build |
| 26 | `update_schedule` | `PUT /api/companies/{id}/schedules/{scheduleId}` | ❌ build |
| 27 | `create_location` | `POST /api/companies/{id}/locations` | ❌ build |
| 28 | `create_area` | `POST /api/companies/{id}/areas` | ❌ build |

---

## 4. Detailed Tool Specifications

Each specification includes: input schema, API call, response shape.

---

### Tool 5 — `list_people`

**Description:** List all employees for a company with optional pagination and search.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":    { "type": "string", "description": "Company ID" },
    "page_number":   { "type": "integer", "description": "Page number (default 1)" },
    "page_size":     { "type": "integer", "description": "Page size (default 10, max 100)" },
    "search_query":  { "type": "string",  "description": "Optional name/email search filter" }
  },
  "required": ["company_id"]
}
```

**API call:**
```
GET /api/companies/{company_id}/people?pageNumber={page_number}&pageSize={page_size}&searchQuery={search_query}
```

**Response shape:**
```python
{
  "company_id": str,
  "total_people": int,
  "page_number": int,
  "page_size": int,
  "people": [ PersonDto, ... ],
  "timestamp": ISO8601
}
```

---

### Tool 6 — `get_person`

**Description:** Get a single employee record by their numeric ID.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string", "description": "Company ID" },
    "person_id":  { "type": "string", "description": "Person ID (numeric)" }
  },
  "required": ["company_id", "person_id"]
}
```

**API call:**
```
GET /api/companies/{company_id}/people/{person_id}
```

---

### Tool 7 — `list_locations`

**Description:** List all work locations for a company.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string", "description": "Company ID" }
  },
  "required": ["company_id"]
}
```

**API call:**
```
GET /api/companies/{company_id}/locations
```

---

### Tool 8 — `list_areas`

**Description:** List all areas (zones within locations) for a company.

**Input Schema:** Same as `list_locations`.

**API call:**
```
GET /api/companies/{company_id}/areas
```

---

### Tool 9 — `get_shift_events_for_person`

**Description:** Retrieve all clock-in/clock-out shift events for a specific employee.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string", "description": "Company ID" },
    "person_id":  { "type": "string", "description": "Person ID (numeric)" }
  },
  "required": ["company_id", "person_id"]
}
```

**API call:**
```
GET /api/companies/{company_id}/shiftevents/person/{person_id}
```

**Response shape:**
```python
{
  "company_id": str,
  "person_id": str,
  "total_events": int,
  "events": [ ShiftEventDto, ... ],
  "timestamp": ISO8601
}
```

---

### Tool 10 — `create_shift_event`

**Description:** Create a clock-in or clock-out shift event for an employee. Used by the kiosk flow.

> ⚠️ **Write operation** — requires `Authorization: Bearer` token to be forwarded to the .NET API. See section 5 on auth forwarding.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":   { "type": "string", "description": "Company ID" },
    "person_id":    { "type": "integer", "description": "Person ID" },
    "event_type":   { "type": "string", "description": "'ClockIn' or 'ClockOut'" },
    "location_id":  { "type": "integer", "description": "Location ID (optional)" },
    "event_log_id": { "type": "string",  "description": "Client idempotency UUID (optional; generated if omitted)" }
  },
  "required": ["company_id", "person_id", "event_type"]
}
```

**API call:**
```
POST /api/companies/{company_id}/shiftevents
Body: {
  "personId": person_id,
  "eventType": event_type,
  "locationId": location_id,
  "eventLogId": event_log_id or str(uuid.uuid4()),
  "eventDate": datetime.now().isoformat()
}
```

**Notes:**
- The API returns `409 Conflict` if the same `eventLogId` is submitted twice (idempotency).
- Always generate a UUID client-side if not provided by the caller.

---

### Tool 11 — `get_schedules_paged`

**Description:** Retrieve a paginated, filtered list of schedules. Preferred over `get_employee_schedules` for large datasets.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":      { "type": "string",  "description": "Company ID" },
    "person_id":       { "type": "integer", "description": "Filter by person (optional)" },
    "location_id":     { "type": "integer", "description": "Filter by location (optional)" },
    "start_date":      { "type": "string",  "description": "ISO date start of range (optional)" },
    "end_date":        { "type": "string",  "description": "ISO date end of range (optional)" },
    "search_query":    { "type": "string",  "description": "Free-text search (optional)" },
    "page":            { "type": "integer", "description": "Page number (default 1)" },
    "page_size":       { "type": "integer", "description": "Page size (default 200, max 1000)" },
    "include_voided":  { "type": "boolean", "description": "Include voided schedules (default false)" }
  },
  "required": ["company_id"]
}
```

**API call:**
```
GET /api/companies/{company_id}/schedules/paged
  ?personId=...&locationId=...&startDate=...&endDate=...
  &searchQuery=...&page=...&pageSize=...&includeVoided=...
```

**Response shape (mirrors API `PagedResultDto`):**
```python
{
  "company_id": str,
  "items": [ ScheduleDto, ... ],
  "total_count": int,
  "page": int,
  "page_size": int,
  "timestamp": ISO8601
}
```

---

### Tool 12 — `create_person`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":   { "type": "string", "description": "Company ID" },
    "first_name":   { "type": "string" },
    "last_name":    { "type": "string" },
    "email":        { "type": "string" },
    "phone":        { "type": "string", "description": "Optional" },
    "pin":          { "type": "string", "description": "4-digit PIN (will be hashed server-side)" }
  },
  "required": ["company_id", "first_name", "last_name"]
}
```

**API call:**
```
POST /api/companies/{company_id}/people
Body: { "firstName": ..., "lastName": ..., "email": ..., "phone": ..., "pin": ... }
```

---

### Tool 13 — `update_person_status`

**Description:** Change a person's ActivityStatus (Active, Inactive, Sandbox, etc.).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string" },
    "person_id":  { "type": "string" },
    "status":     { "type": "string", "description": "'Active' | 'Inactive' | 'Sandbox'" }
  },
  "required": ["company_id", "person_id", "status"]
}
```

**API call:**
```
PATCH /api/companies/{company_id}/people/{person_id}/status
Body: { "status": "Active" }
```

---

### Tool 14 — `get_user_by_email`

**Description:** Look up a Person record by email address (used after Firebase login to get personId + companyId).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "email": { "type": "string", "description": "Email address to look up" }
  },
  "required": ["email"]
}
```

**API call:**
```
GET /api/auth/user/{email}
```

---

### Tool 15 — `verify_pin`

**Description:** Verify a person's kiosk PIN (BCrypt-hashed on the server).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "person_id": { "type": "integer", "description": "Person ID" },
    "pin":       { "type": "string",  "description": "Clear-text PIN to verify" }
  },
  "required": ["person_id", "pin"]
}
```

**API call:**
```
POST /api/auth/verify-pin
Body: { "personId": person_id, "pin": pin }
```

**Response:** `{ "verified": true|false }`

---

### Tool 16 — `list_crews`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string" }
  },
  "required": ["company_id"]
}
```

**API call:** `GET /api/companies/{company_id}/crews`

---

### Tool 17 — `list_roles`

**Input Schema:** Same as `list_crews`.

**API call:** `GET /api/companies/{company_id}/roles`

---

### Tool 18 — `get_company_settings`

**Input Schema:** Same as `list_crews`.

**API call:** `GET /api/companies/{company_id}/settings`

---

### Tool 19 — `get_kiosk_questions`

**Description:** Get the active kiosk questions shown to employees on clock-in.

> ✅ No auth required (`AllowAnonymous`).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string" }
  },
  "required": ["company_id"]
}
```

**API call:** `GET /api/kiosk/{company_id}/questions`

---

### Tool 20 — `post_kiosk_answers`

**Description:** Submit kiosk question answers (called after clock-in).

> ✅ No auth required (`AllowAnonymous`).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "answers": {
      "type": "array",
      "description": "Array of KioskAnswer objects",
      "items": {
        "type": "object",
        "properties": {
          "questionId": { "type": "integer" },
          "personId":   { "type": "integer" },
          "answer":     { "type": "string" }
        }
      }
    }
  },
  "required": ["answers"]
}
```

**API call:** `POST /api/kiosk/answers`

---

### Tools 21–24 — Sandbox Tools

#### Tool 21 — `get_sandbox_status`

**Input Schema:** `{ "company_id": string (required) }`

**API call:** `GET /api/companies/{company_id}/sandbox/status`

**Response:** `{ "hasSandboxData": bool, "sandboxPersonCount": int, "sandboxAreaCount": int, "sandboxLocationCount": int }`

#### Tool 22 — `hide_sandbox_data`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":   { "type": "string" },
    "entity_types": {
      "type": "array",
      "items": { "type": "string", "enum": ["Person", "Area", "Location", "All"] },
      "description": "Entity types to hide. Use ['All'] to hide everything."
    }
  },
  "required": ["company_id"]
}
```

**API call:** `POST /api/companies/{company_id}/sandbox/hide`  
**Body:** `{ "entityTypes": entity_types }`

#### Tool 23 — `reset_sandbox_data`

**Input Schema:** `{ "company_id": string (required) }`

**API call:** `POST /api/companies/{company_id}/sandbox/reset`

#### Tool 24 — `delete_sandbox_data`

**Input Schema:** `{ "company_id": string (required) }`

**API call:** `POST /api/companies/{company_id}/sandbox/delete`

> ⚠️ Returns `403` if the company is on the Free plan. Returns `204` on success.

---

### Tools 25–26 — Schedule Write

#### Tool 25 — `create_schedule`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":   { "type": "string" },
    "person_id":    { "type": "integer" },
    "location_id":  { "type": "integer" },
    "start_time":   { "type": "string", "description": "ISO 8601 datetime" },
    "end_time":     { "type": "string", "description": "ISO 8601 datetime" },
    "notes":        { "type": "string", "description": "Optional notes" }
  },
  "required": ["company_id", "person_id", "location_id", "start_time", "end_time"]
}
```

**API call:** `POST /api/companies/{company_id}/schedules`

#### Tool 26 — `update_schedule`

**Input Schema:** Same as `create_schedule` but with `schedule_id` (required) and all shift fields optional.

**API call:** `PUT /api/companies/{company_id}/schedules/{schedule_id}`

---

### Tools 27–28 — Location / Area Create

#### Tool 27 — `create_location`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id": { "type": "string" },
    "name":       { "type": "string" },
    "address":    { "type": "string", "description": "Optional" },
    "time_zone":  { "type": "string", "description": "Optional, e.g. 'America/New_York'" }
  },
  "required": ["company_id", "name"]
}
```

**API call:** `POST /api/companies/{company_id}/locations`

#### Tool 28 — `create_area`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "company_id":  { "type": "string" },
    "name":        { "type": "string" },
    "location_id": { "type": "integer", "description": "Parent location (optional)" }
  },
  "required": ["company_id", "name"]
}
```

**API call:** `POST /api/companies/{company_id}/areas`

---

## 5. Implementation Pattern

Follow this three-step pattern for each new tool. Use `list_people` (Tool 5) as a reference.

### Step A — Register the tool in `list_tools`

Inside `_setup_handlers` → `list_tools()`:

```python
Tool(
    name="list_people",
    description="List all employees for a company with optional pagination and search.",
    inputSchema={
        "type": "object",
        "properties": {
            "company_id":   {"type": "string",  "description": "Company ID"},
            "page_number":  {"type": "integer", "description": "Page number (default 1)"},
            "page_size":    {"type": "integer", "description": "Page size (default 10, max 100)"},
            "search_query": {"type": "string",  "description": "Optional name/email filter"}
        },
        "required": ["company_id"]
    }
),
```

### Step B — Add the dispatch branch in `call_tool`

```python
elif name == "list_people":
    result = await self._list_people_impl(arguments)
    return [TextContent(type="text", text=json.dumps(result))]
```

### Step C — Write the `_impl` method

```python
async def _list_people_impl(self, arguments: dict) -> dict:
    company_id = arguments.get("company_id")
    if not company_id:
        raise ValueError("company_id is required")

    page_number = int(arguments.get("page_number", 1))
    page_size   = min(int(arguments.get("page_size", 10)), 100)
    search_query = arguments.get("search_query", "")

    params: dict = {"pageNumber": page_number, "pageSize": page_size}
    if search_query:
        params["searchQuery"] = search_query

    try:
        response = await self._http_get(f"/api/companies/{company_id}/people", params=params)
        if response.status_code == 404:
            return {"company_id": company_id, "total_people": 0, "people": []}
        response.raise_for_status()
        people = response.json()
        return {
            "company_id": company_id,
            "total_people": len(people),
            "page_number": page_number,
            "page_size": page_size,
            "people": people,
            "timestamp": datetime.now().isoformat()
        }
    except httpx.RequestError:
        logger.error("Network error in list_people", exc_info=True)
        raise RuntimeError("Network error: is the API server reachable?")
    except Exception:
        logger.error("API error in list_people", exc_info=True)
        raise RuntimeError("API error")
```

### Step D — Add the HTTP REST route (for direct HTTP callers)

In `_setup_http_routes`:

```python
@self.routes.get('/api/companies/{company_id}/people')
async def list_people_endpoint(request):
    company_id = request.match_info['company_id']
    page_number  = int(request.query.get('pageNumber', 1))
    page_size    = int(request.query.get('pageSize', 10))
    search_query = request.query.get('searchQuery', '')
    try:
        result = await self._list_people_impl({
            "company_id": company_id,
            "page_number": page_number,
            "page_size": page_size,
            "search_query": search_query
        })
        return web.json_response(result)
    except ValueError as e:
        return _http_error_response(str(e), status=400)
    except Exception:
        return _http_error_response("Internal server error", status=500)
```

---

## 6. Write Operations (POST/PUT/PATCH/DELETE)

The existing `_http_get` helper handles GET + retry. For write operations add a `_http_post` helper following the same retry pattern:

```python
async def _http_post(self, path: str, body: dict, method: str = "POST") -> httpx.Response:
    """Retrying POST/PUT/PATCH/DELETE wrapper."""
    client = await self._get_http_client()
    last_exc = None
    for attempt in range(1, HTTPX_RETRIES + 1):
        try:
            if method == "POST":
                resp = await client.post(path, json=body)
            elif method == "PUT":
                resp = await client.put(path, json=body)
            elif method == "PATCH":
                resp = await client.patch(path, json=body)
            elif method == "DELETE":
                resp = await client.delete(path)
            else:
                raise ValueError(f"Unsupported method: {method}")
            if 500 <= resp.status_code < 600 and attempt < HTTPX_RETRIES:
                raise httpx.HTTPStatusError("Server error", request=resp.request, response=resp)
            return resp
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            last_exc = e
            backoff = HTTPX_BACKOFF_FACTOR * (2 ** (attempt - 1))
            await asyncio.sleep(backoff)
    raise last_exc
```

For `create_shift_event` also import `uuid`:
```python
import uuid
# In _impl:
event_log_id = arguments.get("event_log_id") or str(uuid.uuid4())
```

---

## 7. Auth Forwarding for Write Operations

The MCP server currently uses a shared `httpx.AsyncClient` with no bearer token. The .NET API requires `Authorization: Bearer <Firebase JWT>` for most write endpoints (e.g. `POST /shiftevents`).

**Strategy for MCP context:** The agent should pass the bearer token as an argument:

```python
# In _impl method for write tools:
bearer_token = arguments.get("bearer_token")
headers = {}
if bearer_token:
    headers["Authorization"] = f"Bearer {bearer_token}"

response = await client.post(path, json=body, headers=headers)
```

Add `bearer_token` as an **optional** parameter to all write tool input schemas:

```json
"bearer_token": {
  "type": "string",
  "description": "Firebase ID token (Authorization: Bearer). Required for authenticated write operations."
}
```

---

## 8. Update `/api/tools` Index Endpoint

After adding each tool, update the `list_tools_endpoint` handler in `_setup_http_routes` to include the new tool in the static list returned:

```python
@self.routes.get('/api/tools')
async def list_tools_endpoint(request):
    tools = [
        # ... existing tools ...
        {"name": "list_people",            "description": "List all employees for a company"},
        {"name": "get_person",             "description": "Get single employee by ID"},
        {"name": "list_locations",         "description": "List all locations"},
        {"name": "list_areas",             "description": "List all areas"},
        {"name": "get_shift_events_for_person", "description": "Shift events for an employee"},
        {"name": "create_shift_event",     "description": "Create clock-in or clock-out event"},
        {"name": "get_schedules_paged",    "description": "Paged + filtered schedule list"},
        # ... etc for all 28 tools
    ]
    return web.json_response({"tools": tools, "total_tools": len(tools), ...})
```

---

## 9. Environment Variables Reference

| Variable | Default | Notes |
|----------|---------|-------|
| `API_BASE_URL` | `http://localhost:5182` | Must include `http://` or `https://` |
| `MCP_AUTH_TOKEN` | *(unset)* | Enables bearer auth on all `/api/*` routes |
| `ALLOWED_ORIGINS` | `http://localhost:8080,...` | Comma-separated CORS origins |
| `LISTEN_HOST` | `0.0.0.0` | Use `127.0.0.1` for local-only |
| `LISTEN_PORT` | `8080` | HTTP port |
| `HTTPX_TIMEOUT` | `30.0` | Seconds before request timeout |
| `HTTPX_RETRIES` | `3` | Number of retries on 5xx / network error |
| `HTTPX_BACKOFF_FACTOR` | `0.5` | Exponential backoff base (seconds) |
| `LOG_LEVEL` | `INFO` | Python logging level |

---

## 10. Testing Each New Tool

Use the existing `/api/tools/execute` endpoint:

```bash
# Example: test list_people
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -d '{
    "tool_name": "list_people",
    "arguments": {
      "company_id": "your-company-id",
      "page_number": 1,
      "page_size": 5
    }
  }'
```

Expected response:
```json
{
  "tool_name": "list_people",
  "result": {
    "company_id": "your-company-id",
    "total_people": 5,
    "people": [ ... ]
  },
  "timestamp": "2026-03-06T..."
}
```

Also verify the direct REST route works:
```bash
curl "http://localhost:8080/api/companies/your-company-id/people?pageSize=5"
```

---

## 11. Build Order Recommendation

1. **Start with read-only tools (Priority 1):** `list_people`, `get_person`, `list_locations`, `list_areas`, `get_shift_events_for_person`, `get_schedules_paged` — these follow the existing `_http_get` pattern exactly.  
2. **Add `_http_post` helper** once, then implement `create_shift_event`.  
3. **Add admin tools (Priority 2):** `get_user_by_email`, `verify_pin`, `list_crews`, `list_roles`, `get_company_settings`.  
4. **Add kiosk + sandbox tools (Priority 3):** no-auth kiosk tools are simple; sandbox tools add business logic (plan gate handling).  
5. **Add write tools (Priority 4):** `create_schedule`, `update_schedule`, `create_location`, `create_area` — follow the auth-forwarding pattern from section 7.  

---

## 12. Related Files

| File | Role |
|------|------|
| `python_client/http_mcp_server.py` | **Target** — all tool implementation goes here |
| `python_client/MCP_SERVER.md` | Deployment + security guide |
| `python_client/requirements.txt` | Python dependencies |
| `ShiftWork.Api/Controllers/` | Source of truth for all endpoints |
| `ShiftWork.Api/DTOs/` | Request/response shapes |
| `ShiftWork.Api/ShiftWork.Api.http` | Manual test examples for the .NET API |
| `AGENT.md` | Core agent guide including kiosk flow walkthrough |
