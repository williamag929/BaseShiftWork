#!/usr/bin/env python3
"""
HTTP-enabled MCP server for ShiftWork API
Supports both MCP protocol and HTTP REST endpoints

Security / robustness improvements:
- Bind to configurable host (default 0.0.0.0) so Docker works
- Validate and use API_BASE_URL defaulting to http://localhost:5182
- Add optional bearer token authentication via MCP_AUTH_TOKEN
- Restrict CORS to configured ALLOWED_ORIGINS (comma-separated) with safe default
- CORS credentials only enabled when authentication is active
- Use a small retry/backoff wrapper for HTTP calls to the .NET API
- Avoid leaking internal exception details to clients
- Normalize types when filtering schedules (compare strings)
- Audit logging for authentication attempts and tool executions
- Connection limits for httpx client (max 100 connections)
"""

import asyncio
import json
import logging
import sys
from typing import List, Dict, Any, Optional
import inspect
from datetime import datetime
import time
import re

import os

import httpx
from mcp.server.lowlevel import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# HTTP server imports
from aiohttp import web
from aiohttp.web import Application, RouteTableDef
import aiohttp_cors

# Basic logging configuration with level controlled by env var
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger(__name__)

# Environment-driven configuration
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:5182")
# Validate basic URL form
if not re.match(r"^https?://", API_BASE_URL):
    logger.warning("API_BASE_URL does not include scheme, defaulting to http://localhost:5182")
    API_BASE_URL = "http://localhost:5182"

LISTEN_HOST = os.environ.get("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8080"))

# Optional auth token: if set, require incoming requests to provide Authorization: Bearer <token>
AUTH_TOKEN = os.environ.get("MCP_AUTH_TOKEN")

# CORS allowed origins (comma-separated). Default to localhost MCP server + production.
_allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:8080,https://mcp.joblogsmart.com")
ALLOWED_ORIGINS = [o.strip() for o in _allowed.split(",") if o.strip()]
if len(ALLOWED_ORIGINS) == 0:
    ALLOWED_ORIGINS = ["http://localhost:8080", "https://mcp.joblogsmart.com"]
logger.info(f"CORS Allowed Origins: {ALLOWED_ORIGINS}")

# HTTPX client timeout and retry settings
HTTPX_TIMEOUT = float(os.environ.get("HTTPX_TIMEOUT", "30.0"))
HTTPX_RETRIES = int(os.environ.get("HTTPX_RETRIES", "3"))
HTTPX_BACKOFF_FACTOR = float(os.environ.get("HTTPX_BACKOFF_FACTOR", "0.5"))

# Audit logger for security events
audit_logger = logging.getLogger("audit")
audit_handler = logging.StreamHandler()
audit_handler.setFormatter(logging.Formatter('%(asctime)s - AUDIT - %(message)s'))
audit_logger.addHandler(audit_handler)
audit_logger.setLevel(logging.INFO)

def _log_audit_event(event_type: str, details: dict):
    """Log security-relevant events for audit trail"""
    audit_logger.info(f"{event_type}: {json.dumps(details)}")

# Small helper for safe error responses
def _http_error_response(message: str, status: int = 500):
    # Do not include stack traces or raw exception text in production responses
    return web.json_response({"error": message, "timestamp": datetime.now().isoformat()}, status=status)

class ShiftWorkServer:
    def __init__(self, http_port: int = LISTEN_PORT):
        self.server = Server("shiftwork-server")
        self.http_client: Optional[httpx.AsyncClient] = None
        self.http_port = http_port
        self.http_app: Optional[Application] = None
        # Use validated module-level API_BASE_URL
        self.api_base_url = API_BASE_URL
        logger.info(f"API base URL: {self.api_base_url}")
        self._setup_handlers()
        self._setup_http_routes()

    async def _get_http_client(self) -> httpx.AsyncClient:
        if self.http_client is None:
            # Create a single shared AsyncClient instance with connection limits
            self.http_client = httpx.AsyncClient(
                base_url=self.api_base_url,
                timeout=HTTPX_TIMEOUT,
                headers={"Accept": "application/json"},
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
            )
        return self.http_client

    async def _http_get(self, path: str, params: dict | None = None) -> httpx.Response:
        """Simple retrying GET wrapper with exponential backoff."""
        client = await self._get_http_client()
        last_exc = None
        for attempt in range(1, HTTPX_RETRIES + 1):
            try:
                resp = await client.get(path, params=params)
                # Raise for 5xx server errors so we can retry
                if 500 <= resp.status_code < 600 and attempt < HTTPX_RETRIES:
                    logger.warning(f"Server error {resp.status_code} on GET {path}, attempt {attempt}/{HTTPX_RETRIES}")
                    raise httpx.HTTPStatusError("Server error", request=resp.request, response=resp)
                return resp
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                last_exc = e
                backoff = HTTPX_BACKOFF_FACTOR * (2 ** (attempt - 1))
                logger.debug(f"HTTP GET attempt {attempt} failed for {path}: {e}; sleeping {backoff}s before retry")
                await asyncio.sleep(backoff)
        # If we exhausted retries, raise the last exception
        raise last_exc

    def _setup_handlers(self):
        """Setup MCP handlers"""
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            logger.info("list_tools called")
            return [
                Tool(
                    name="get_employee_schedules",
                    description="Get all schedules for a specific employee. Returns detailed schedule information including dates, times, and shift details.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company_id": {"type": "string", "description": "The unique identifier for the company"},
                            "person_id": {"type": "string", "description": "The unique identifier for the employee"}
                        },
                        "required": ["company_id", "person_id"]
                    }
                ),
                Tool(
                    name="get_company_info",
                    description="Get basic information about a company",
                    inputSchema={
                        "type": "object",
                        "properties": {"company_id": {"type": "string", "description": "Company ID"}},
                        "required": ["company_id"]
                    }
                ),
                Tool(
                    name="get_people_with_unpublished_schedules",
                    description="List people who have unpublished schedules within an optional date range.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company_id": {"type": "string", "description": "The unique identifier for the company"},
                            "start_date": {"type": "string", "description": "Optional ISO date/time for range start"},
                            "end_date": {"type": "string", "description": "Optional ISO date/time for range end"}
                        },
                        "required": ["company_id"]
                    }
                ),
                Tool(
                    name="ping",
                    description="Test server connectivity",
                    inputSchema={"type": "object", "properties": {}, "required": []}
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict) -> List[TextContent]:
            logger.info(f"Tool called: {name}")
            try:
                if name == "ping":
                    return [TextContent(type="text", text="pong - server is running")]

                elif name == "get_employee_schedules":
                    result = await self._get_employee_schedules_impl(arguments)
                    return [TextContent(type="text", text=json.dumps(result))]

                elif name == "get_people_with_unpublished_schedules":
                    result = await self._get_people_with_unpublished_schedules_impl(arguments)
                    return [TextContent(type="text", text=json.dumps(result))]

                else:
                    logger.warning(f"Unknown tool requested: {name}")
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]

            except Exception as e:
                # Log internal error with stack trace but return a safe message to caller
                logger.error(f"Tool error for {name}: {e}", exc_info=True)
                return [TextContent(type="text", text="Server error")]

    async def _get_employee_schedules_impl(self, arguments: dict) -> dict:
        """Implementation for getting employee schedules"""
        company_id = arguments.get("company_id")
        person_id = arguments.get("person_id")

        if not company_id or not person_id:
            raise ValueError("Both company_id and person_id are required")

        try:
            # Normalize types to string when filtering
            person_id_str = str(person_id)

            response = await self._http_get(f"/api/companies/{company_id}/schedules")

            if response.status_code == 404:
                return {
                    "company_id": company_id,
                    "person_id": person_id_str,
                    "error": f"Company {company_id} not found",
                    "total_schedules": 0,
                    "schedules": []
                }

            response.raise_for_status()
            all_schedules = response.json()

            # Filter for employee; normalize schedule person ids to string
            employee_schedules = [
                s for s in all_schedules
                if str(s.get("personId")) == person_id_str
            ]

            return {
                "company_id": company_id,
                "person_id": person_id_str,
                "total_schedules": len(employee_schedules),
                "schedules": employee_schedules,
                "timestamp": datetime.now().isoformat()
            }

        except httpx.RequestError as e:
            logger.error("Network error when contacting API", exc_info=True)
            raise RuntimeError("Network error: is the API server reachable?")
        except Exception as e:
            logger.error("API error while getting schedules", exc_info=True)
            raise RuntimeError("API error")

    async def _get_people_with_unpublished_schedules_impl(self, arguments: dict) -> dict:
        """Implementation for listing people with unpublished schedules"""
        company_id = arguments.get("company_id")
        start_date = arguments.get("start_date")
        end_date = arguments.get("end_date")

        if not company_id:
            raise ValueError("company_id is required")

        try:
            params = {}
            if start_date:
                params["startDate"] = start_date
            if end_date:
                params["endDate"] = end_date

            response = await self._http_get(f"/api/companies/{company_id}/people/unpublished-schedules", params=params)

            if response.status_code == 404:
                return {"company_id": company_id, "total_people": 0, "people": [], "message": "No people with unpublished schedules found"}

            response.raise_for_status()
            people = response.json()

            return {
                "company_id": company_id,
                "total_people": len(people),
                "people": people,
                "timestamp": datetime.now().isoformat()
            }
        except httpx.RequestError:
            logger.error("Network error when contacting API", exc_info=True)
            raise RuntimeError("Network error: is the API server reachable?")
        except Exception:
            logger.error("API error while getting unpublished schedules", exc_info=True)
            raise RuntimeError("API error")

    def _setup_http_routes(self):
        """Setup HTTP routes with optional auth and tightened CORS"""
        self.routes = web.RouteTableDef()

        # Authentication middleware
        @web.middleware
        async def auth_middleware(request, handler):
            # Only protect API routes
            if AUTH_TOKEN and request.path.startswith('/api'):
                auth_hdr = request.headers.get('Authorization', '')
                if not auth_hdr.startswith('Bearer '):
                    _log_audit_event("AUTH_FAILED", {
                        "reason": "missing_bearer_token",
                        "path": request.path,
                        "remote": request.remote
                    })
                    return _http_error_response("Unauthorized", status=401)
                token = auth_hdr.split(' ', 1)[1].strip()
                if token != AUTH_TOKEN:
                    _log_audit_event("AUTH_FAILED", {
                        "reason": "invalid_token",
                        "path": request.path,
                        "remote": request.remote
                    })
                    return _http_error_response("Unauthorized", status=401)
                _log_audit_event("AUTH_SUCCESS", {
                    "path": request.path,
                    "remote": request.remote
                })
            return await handler(request)

        # Health check endpoint
        @self.routes.get('/health')
        async def health_check(request):
            return web.json_response({
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "service": "shiftwork-mcp-server",
                "version": "1.0.0"
            })

        # Ping endpoint
        @self.routes.get('/ping')
        @self.routes.post('/ping')
        async def ping_endpoint(request):
            return web.json_response({"message": "pong - server is running", "timestamp": datetime.now().isoformat()})

        # Get employee schedules endpoint
        @self.routes.get('/api/employees/{company_id}/{person_id}/schedules')
        async def get_schedules_endpoint(request):
            company_id = request.match_info['company_id']
            person_id = request.match_info['person_id']
            try:
                result = await self._get_employee_schedules_impl({"company_id": company_id, "person_id": person_id})
                return web.json_response(result)
            except ValueError as e:
                return _http_error_response(str(e), status=400)
            except Exception as e:
                logger.error(f"HTTP endpoint error: {e}", exc_info=True)
                return _http_error_response("Internal server error", status=500)

        # POST endpoint for schedules (with JSON body)
        @self.routes.post('/api/employees/schedules')
        async def post_schedules_endpoint(request):
            try:
                data = await request.json()
                result = await self._get_employee_schedules_impl(data)
                return web.json_response(result)
            except json.JSONDecodeError:
                return _http_error_response("Invalid JSON in request body", status=400)
            except ValueError as e:
                return _http_error_response(str(e), status=400)
            except Exception as e:
                logger.error(f"HTTP POST endpoint error: {e}", exc_info=True)
                return _http_error_response("Internal server error", status=500)

        # Get people with unpublished schedules
        @self.routes.get('/api/companies/{company_id}/people/unpublished-schedules')
        async def get_people_with_unpublished_schedules_endpoint(request):
            company_id = request.match_info['company_id']
            start_date = request.query.get('startDate')
            end_date = request.query.get('endDate')

            try:
                result = await self._get_people_with_unpublished_schedules_impl({"company_id": company_id, "start_date": start_date, "end_date": end_date})
                return web.json_response(result)
            except ValueError as e:
                return _http_error_response(str(e), status=400)
            except Exception as e:
                logger.error(f"HTTP endpoint error: {e}", exc_info=True)
                return _http_error_response("Internal server error", status=500)

        # MCP tools endpoint
        @self.routes.get('/api/tools')
        async def list_tools_endpoint(request):
            tools = [
                {"name": "get_employee_schedules", "description": "Get all schedules for a specific employee", "parameters": {"company_id": "string (required)", "person_id": "string (required)"}},
                {"name": "get_people_with_unpublished_schedules", "description": "List people who have unpublished schedules", "parameters": {"company_id": "string (required)", "start_date": "string (optional, ISO date/time)", "end_date": "string (optional, ISO date/time)"}},
                {"name": "ping", "description": "Test server connectivity", "parameters": {}}
            ]
            return web.json_response({"tools": tools, "total_tools": len(tools), "timestamp": datetime.now().isoformat()})

        # Generic tool execution endpoint
        @self.routes.post('/api/tools/execute')
        async def execute_tool_endpoint(request):
            try:
                data = await request.json()
                tool_name = data.get("tool_name") or data.get("name")
                arguments = data.get("arguments", {})

                if not tool_name:
                    return _http_error_response("tool_name is required", status=400)

                # Audit log tool execution
                _log_audit_event("TOOL_EXECUTE", {
                    "tool": tool_name,
                    "args": arguments,
                    "remote": request.remote
                })

                if tool_name == "ping":
                    result = {"message": "pong - server is running"}
                elif tool_name == "get_employee_schedules":
                    result = await self._get_employee_schedules_impl(arguments)
                elif tool_name == "get_people_with_unpublished_schedules":
                    result = await self._get_people_with_unpublished_schedules_impl(arguments)
                else:
                    return _http_error_response(f"Unknown tool: {tool_name}", status=404)

                return web.json_response({"tool_name": tool_name, "result": result, "timestamp": datetime.now().isoformat()})

            except json.JSONDecodeError:
                return _http_error_response("Invalid JSON in request body", status=400)
            except ValueError as e:
                return _http_error_response(str(e), status=400)
            except Exception as e:
                logger.error(f"Tool execution error: {e}", exc_info=True)
                return _http_error_response("Internal server error", status=500)

        # Build app and apply middleware + routes
        self.http_app = web.Application(middlewares=[auth_middleware])
        self.http_app.add_routes(self.routes)

    async def _create_http_app(self):
        """Create HTTP application and configure CORS"""
        if not self.http_app:
            self._setup_http_routes()
        app = self.http_app

        # Configure CORS per configured allowed origins
        cors = aiohttp_cors.setup(app)
        for route in list(app.router.routes()):
            for origin in ALLOWED_ORIGINS:
                cors.add(route, {
                    origin: aiohttp_cors.ResourceOptions(
                        allow_credentials=bool(AUTH_TOKEN),  # Only allow credentials if auth is enabled
                        expose_headers="*",
                        allow_headers="*",
                        allow_methods="*"
                    )
                })
        return app

    async def run_http_server(self):
        """Run HTTP server (bind to configured host)"""
        try:
            app = await self._create_http_app()
            runner = web.AppRunner(app)
            await runner.setup()

            site = web.TCPSite(runner, LISTEN_HOST, self.http_port)
            await site.start()

            logger.info(f"HTTP server started on http://{LISTEN_HOST}:{self.http_port}")
            return runner

        except Exception as e:
            logger.error(f"Failed to start HTTP server: {e}", exc_info=True)
            raise

    async def run_mcp_server(self):
        logger.info("Starting MCP Server (stdio mode)...")
        try:
            async with stdio_server() as (read_stream, write_stream):
                await self.server.run(
                    read_stream,
                    write_stream,
                    InitializationOptions(
                        server_name="shiftwork-server",
                        server_version="1.0.0",
                        capabilities=self.server.get_capabilities(notification_options=NotificationOptions(), experimental_capabilities={}),
                    ),
                )
        except Exception as e:
            logger.error(f"MCP server error: {e}", exc_info=True)
            raise

    async def run_both_servers(self):
        logger.info(f"Starting ShiftWork Server with HTTP on port {self.http_port}...")
        try:
            http_runner = await self.run_http_server()
            logger.info("Both servers running. Press Ctrl+C to stop.")
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Servers stopped by user")
        except Exception as e:
            logger.error(f"Server error: {e}", exc_info=True)
            raise
        finally:
            if self.http_client:
                await self.http_client.aclose()
            if hasattr(self, 'http_runner') and http_runner:
                await http_runner.cleanup()

    async def run_http_only(self):
        logger.info(f"Starting HTTP-only ShiftWork Server on port {self.http_port}...")
        try:
            http_runner = await self.run_http_server()
            logger.info("HTTP server running. Press Ctrl+C to stop.")
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("HTTP server stopped by user")
        except Exception as e:
            logger.error(f"HTTP server error: {e}", exc_info=True)
            raise
        finally:
            if self.http_client:
                await self.http_client.aclose()
            if http_runner:
                await http_runner.cleanup()

async def main():
    import argparse

    parser = argparse.ArgumentParser(description='ShiftWork MCP Server')
    parser.add_argument('--port', type=int, default=LISTEN_PORT, help='HTTP server port (default: 8080)')
    parser.add_argument('--mode', choices=['http', 'mcp', 'both'], default='http', help='Server mode: http (HTTP only), mcp (MCP only), both (default: http)')

    args = parser.parse_args()

    server = ShiftWorkServer(http_port=args.port)

    try:
        if args.mode == 'http':
            await server.run_http_only()
        elif args.mode == 'mcp':
            await server.run_mcp_server()
        elif args.mode == 'both':
            await server.run_both_servers()
    except KeyboardInterrupt:
        print("Server interrupted")
    except Exception as e:
        print(f"Server failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server interrupted")
    except Exception as e:
        print(f"Server failed: {e}")
        sys.exit(1)
