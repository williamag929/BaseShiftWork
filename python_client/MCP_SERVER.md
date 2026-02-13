# ShiftWork MCP Server — Architecture & Reference

> **File:** `python_client/http_mcp_server.py`
> **Language:** Python 3.11+
> **Purpose:** HTTP + MCP bridge that proxies AI tool calls to the ShiftWork .NET API

---

## 1. High-Level Overview

```
┌─────────────────┐     HTTP/REST      ┌──────────────────────┐     HTTP/REST      ┌──────────────────┐
│  Mobile App      │ ───────────────►  │  MCP Server (Python)  │ ───────────────►  │  ShiftWork API    │
│  (React Native)  │   port 8080       │  http_mcp_server.py   │   port 5182       │  (.NET Core)      │
└─────────────────┘                    └──────────────────────┘                    └──────────────────┘
                                              │
                                              │ stdio (MCP protocol)
                                              ▼
                                       ┌──────────────┐
                                       │  MCP Clients  │
                                       │  (AI agents)  │
                                       └──────────────┘
```

The server operates in **three modes**:
| Mode   | Flag           | Description |
|--------|----------------|-------------|
| `http` | `--mode http`  | HTTP REST only (default) — used by mobile app & Docker |
| `mcp`  | `--mode mcp`   | MCP stdio only — used by AI agent tooling |
| `both` | `--mode both`  | HTTP + MCP concurrently |

---

## 2. Class Structure

### `ShiftWorkServer`

The single main class that owns all state and logic.

```
ShiftWorkServer
├── __init__(http_port=8080)
│   ├── self.server          → MCP Server instance ("shiftwork-server")
│   ├── self.http_client     → httpx.AsyncClient (lazy, connects to .NET API)
│   ├── self.http_port       → int (default 8080)
│   ├── self.api_base_url    → str (from env API_BASE_URL or "http://localhost:5182")
│   ├── _setup_handlers()    → registers MCP tool definitions & call_tool dispatcher
│   └── _setup_http_routes() → registers aiohttp route handlers
│
├── HTTP Client
│   └── _get_http_client()   → creates/returns shared httpx.AsyncClient
│
├── Tool Implementations (business logic)
│   ├── _get_employee_schedules_impl(args)
│   └── _get_people_with_unpublished_schedules_impl(args)
│
├── MCP Handlers (registered on self.server)
│   ├── list_tools()   → returns Tool[] definitions
│   └── call_tool()    → dispatches tool name → implementation
│
├── HTTP Route Handlers (registered on self.routes)
│   ├── GET  /health
│   ├── GET|POST /ping
│   ├── GET  /api/tools
│   ├── POST /api/tools/execute
│   ├── GET  /api/employees/{company_id}/{person_id}/schedules
│   ├── POST /api/employees/schedules
│   └── GET  /api/companies/{company_id}/people/unpublished-schedules
│
└── Server Runners
    ├── run_http_only()      → HTTP server only (event loop)
    ├── run_mcp_server()     → MCP stdio only
    ├── run_both_servers()   → HTTP + MCP concurrently
    ├── run_http_server()    → starts aiohttp app (helper)
    └── _create_http_app()   → builds aiohttp Application with CORS
```

---

## 3. MCP Tools

These are the tools exposed via the MCP protocol (`list_tools` / `call_tool`) **and** mirrored as HTTP endpoints.

### `ping`
| Field | Value |
|-------|-------|
| Description | Test server connectivity |
| Parameters | _none_ |
| Returns | `"pong - server is running"` |

### `get_employee_schedules`
| Field | Value |
|-------|-------|
| Description | Get all schedules for a specific employee |
| Parameters | `company_id` (string, required), `person_id` (string, required) |
| API Call | `GET /api/companies/{company_id}/schedules` → filters by `personId` |
| Returns | `{ company_id, person_id, total_schedules, schedules[], timestamp }` |

### `get_people_with_unpublished_schedules`
| Field | Value |
|-------|-------|
| Description | List people who have unpublished schedules within a date range |
| Parameters | `company_id` (string, required), `start_date` (string, optional), `end_date` (string, optional) |
| API Call | `GET /api/companies/{company_id}/people/unpublished-schedules?startDate=...&endDate=...` |
| Returns | `{ company_id, total_people, people[], timestamp }` |

### `get_company_info`
| Field | Value |
|-------|-------|
| Description | Get basic information about a company |
| Parameters | `company_id` (string, required) |
| Note | Defined in `list_tools` but **not yet implemented** in `call_tool` dispatcher |

---

## 4. HTTP REST Endpoints

All endpoints return JSON with `Content-Type: application/json`. CORS is enabled for all origins.

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| `GET` | `/health` | Health check | — | `{ status, timestamp, service, version }` |
| `GET/POST` | `/ping` | Connectivity test | — | `{ message, timestamp }` |
| `GET` | `/api/tools` | List available tools | — | `{ tools[], total_tools, timestamp }` |
| `POST` | `/api/tools/execute` | Execute any tool by name | `{ tool_name, arguments }` | `{ tool_name, result, timestamp }` |
| `GET` | `/api/employees/{company_id}/{person_id}/schedules` | Get employee schedules | URL params | schedule result |
| `POST` | `/api/employees/schedules` | Get employee schedules | `{ company_id, person_id }` | schedule result |
| `GET` | `/api/companies/{company_id}/people/unpublished-schedules` | Unpublished schedules | `?startDate=&endDate=` | people result |

### Generic Tool Execution — `POST /api/tools/execute`

This is the primary endpoint used by the **mobile AI chat screen**. The request body:

```json
{
  "tool_name": "get_employee_schedules",
  "arguments": {
    "company_id": "abc123",
    "person_id": "8"
  }
}
```

Response:
```json
{
  "tool_name": "get_employee_schedules",
  "result": {
    "company_id": "abc123",
    "person_id": "8",
    "total_schedules": 2,
    "schedules": [ ... ],
    "timestamp": "2026-02-10T12:00:00"
  },
  "timestamp": "2026-02-10T12:00:00"
}
```

---

## 5. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:5182` | Base URL of the ShiftWork .NET API. In Docker set to `http://api:80`. |

---

## 6. Dependencies

From `requirements.txt`:

| Package | Purpose |
|---------|---------|
| `mcp>=1.0.0` | MCP protocol SDK (Server, Tool, TextContent) |
| `httpx>=0.25.0` | Async HTTP client to call .NET API |
| `pydantic>=2.0.0` | Data validation (MCP dependency) |
| `uvicorn>=0.23.0` | ASGI server (available but not directly used) |
| `aiohttp>=3.8.0` | HTTP server framework |
| `aiohttp-cors>=0.7.0` | CORS middleware for aiohttp |

---

## 7. Running Locally

```bash
cd python_client

# Install dependencies
pip install -r requirements.txt

# Run HTTP-only (default, for mobile app consumption)
python http_mcp_server.py --mode http --port 8080

# Run MCP-only (for AI agent stdio clients)
python http_mcp_server.py --mode mcp

# Run both HTTP + MCP
python http_mcp_server.py --mode both --port 8080
```

Make sure the .NET API is running on `http://localhost:5182` (or set `API_BASE_URL`).

---

## 8. Docker

### Dockerfile (`python_client/Dockerfile`)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY http_mcp_server.py .
ENV API_BASE_URL=http://api:80
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "http_mcp_server.py", "--mode", "http", "--port", "8080"]
```

### docker-compose.yml (mcp service)

```yaml
mcp:
  build:
    context: ./python_client
    dockerfile: Dockerfile
  image: shiftwork/mcp:local
  container_name: shiftwork-mcp
  environment:
    API_BASE_URL: "http://api:80"
  ports:
    - "8080:8080"
  depends_on:
    - api
  networks:
    - shiftwork-net
```

### Docker network flow

```
Host :8080  ──►  shiftwork-mcp :8080  ──►  shiftwork-api :80  ──►  shiftwork-mssql :1433
                 (python MCP)              (.NET API)               (SQL Server)
```

---

## 9. Consumer: Mobile AI Chat

The React Native mobile app consumes this server via `services/mcp.service.ts`:

```
McpService (mobile)
├── health()            → GET  /health
├── ping()              → GET  /ping
├── listTools()         → GET  /api/tools
├── executeTool(name, args) → POST /api/tools/execute
├── getEmployeeSchedules(companyId, personId) → executeTool wrapper
├── getPeopleWithUnpublishedSchedules(companyId, ...) → executeTool wrapper
└── chat(message, ctx)  → local intent-matcher → routes to above methods
```

Environment variable on mobile: `EXPO_PUBLIC_MCP_URL` (defaults to `http://localhost:8080`).

The chat screen lives at `app/(tabs)/ai-chat.tsx` and uses quick-action chips + free-text input to call `mcpService.chat()`.

---

## 10. Data Flow — Example: "my schedule"

```
1. User taps "My Schedule" chip in AI Chat screen
2. mcpService.chat("my schedule", { companyId: "abc", personId: 8 })
3. Intent matcher matches /my schedule/ regex
4. mcpService.getEmployeeSchedules("abc", 8)
5. POST http://localhost:8080/api/tools/execute
   body: { tool_name: "get_employee_schedules", arguments: { company_id: "abc", person_id: "8" } }
6. MCP server calls .NET API: GET http://localhost:5182/api/companies/abc/schedules
7. Filters response by personId == "8"
8. Returns { tool_name, result: { schedules: [...] }, timestamp }
9. Mobile formats and displays in chat bubble with "get_employee_schedules" tool badge
```

---

## 11. Extending with New Tools

To add a new tool:

1. **Define** the tool in `_setup_handlers` → `list_tools()` — add a `Tool(name=..., inputSchema=...)`.
2. **Implement** the logic in a new `async def _my_new_tool_impl(self, arguments)` method.
3. **Dispatch** in `call_tool()` — add `elif name == "my_new_tool": ...`.
4. **(Optional)** Add a dedicated HTTP route in `_setup_http_routes()`.
5. **Mirror** in `list_tools_endpoint` HTTP handler so `/api/tools` returns the new tool.
6. **Update** the `execute_tool_endpoint` POST handler to dispatch the new name.

On the mobile side, no changes are needed if you use `mcpService.executeTool("my_new_tool", args)`. For natural-language support, add a regex case in `mcpService.chat()`.

---

## 12. Known Issues / TODOs

| Issue | Status |
|-------|--------|
| `get_company_info` tool is defined in `list_tools` but not implemented in `call_tool` | Missing |
| HTTP server binds to `localhost` (line ~437) — won't work in Docker; should bind to `0.0.0.0` | **Bug** |
| No authentication on MCP HTTP endpoints | By design for now |
| `list_tools_endpoint` duplicates tool definitions instead of reusing `list_tools()` | Tech debt |
| No retry/circuit-breaker on .NET API calls | Enhancement |
