
---

## Configuration & Security (new)

This server adds several environment-driven configuration options for security and deployment. Add these to your runtime environment or Docker compose.

- LISTEN_HOST (default: 0.0.0.0) — host to bind the HTTP server. Use 0.0.0.0 in Docker, 127.0.0.1 for local-only.
- LISTEN_PORT (default: 8080) — HTTP port.
- API_BASE_URL (default: http://localhost:5182) — base URL of the ShiftWork .NET API. Must include http:// or https://.
- MCP_AUTH_TOKEN (optional) — If set, all /api/* endpoints require Authorization: Bearer <token>.
- ALLOWED_ORIGINS (default: http://localhost:8080) — comma-separated list of allowed CORS origins.
- HTTPX_TIMEOUT / HTTPX_RETRIES / HTTPX_BACKOFF_FACTOR — control httpx timeout and retry/backoff behavior.

Example (local run with auth token):

export API_BASE_URL=http://localhost:5182
export MCP_AUTH_TOKEN=changeme
export ALLOWED_ORIGINS=http://localhost:8080
python http_mcp_server.py --mode http --port 8080

Security notes:
- When MCP_AUTH_TOKEN is set, clients must send Authorization: Bearer <token> on all /api requests.
- Keep MCP_AUTH_TOKEN secret and rotate regularly.
- In production, restrict ALLOWED_ORIGINS to your mobile app host(s) only.
- Consider placing the MCP server behind an API gateway for rate-limiting, TLS termination, and advanced auth.

