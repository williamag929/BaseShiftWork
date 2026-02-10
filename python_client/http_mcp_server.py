#!/usr/bin/env python3
"""
HTTP-enabled MCP server for ShiftWork API
Supports both MCP protocol and HTTP REST endpoints
"""

import asyncio
import json
import logging
import sys
from typing import List, Dict, Any, Optional
import inspect
from datetime import datetime

import httpx
from mcp.server.lowlevel import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# HTTP server imports
from aiohttp import web, web_request
from aiohttp.web import Application, RouteTableDef
import aiohttp_cors

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ShiftWorkServer:
    def __init__(self, http_port: int = 8080):
        self.server = Server("shiftwork-server")
        self.http_client = None
        self.http_port = http_port
        self.http_app = None
        self._setup_handlers()
        self._setup_http_routes()
    
    async def _get_http_client(self):
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(
                base_url="http://localhost:5182",
                timeout=30.0
            )
        return self.http_client
    
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
                            "company_id": {
                                "type": "string", 
                                "description": "The unique identifier for the company"
                            },
                            "person_id": {
                                "type": "string", 
                                "description": "The unique identifier for the employee"
                            }
                        },
                        "required": ["company_id", "person_id"]
                    }
                ),
                Tool(
                    name="get_company_info",
                    description="Get basic information about a company",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company_id": {"type": "string", "description": "Company ID"}
                        },
                        "required": ["company_id"]
                    }
                ),
                Tool(
                    name="get_people_with_unpublished_schedules",
                    description="List people who have unpublished schedules within an optional date range.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company_id": {
                                "type": "string",
                                "description": "The unique identifier for the company"
                            },
                            "start_date": {
                                "type": "string",
                                "description": "Optional ISO date/time for range start (e.g., 2026-02-09T00:00:00Z)"
                            },
                            "end_date": {
                                "type": "string",
                                "description": "Optional ISO date/time for range end (e.g., 2026-02-09T23:59:59Z)"
                            }
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
            logger.info(f"Tool called: {name} with arguments: {arguments}")
            
            try:
                if name == "ping":
                    return [TextContent(type="text", text="pong - server is running")]
                
                elif name == "get_employee_schedules":
                    result = await self._get_employee_schedules_impl(arguments)
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]

                elif name == "get_people_with_unpublished_schedules":
                    result = await self._get_people_with_unpublished_schedules_impl(arguments)
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
                    
            except Exception as e:
                logger.error(f"Tool error: {e}", exc_info=True)
                return [TextContent(type="text", text=f"Server error: {str(e)}")]
    
    async def _get_employee_schedules_impl(self, arguments: dict) -> dict:
        """Implementation for getting employee schedules"""
        company_id = arguments.get("company_id")
        person_id = arguments.get("person_id")
        
        if not company_id or not person_id:
            raise ValueError("Both company_id and person_id are required")
        
        try:
            client = await self._get_http_client()
            response = await client.get(f"/api/companies/{company_id}/schedules")
            
            if response.status_code == 404:
                return {
                    "company_id": company_id,
                    "person_id": person_id,
                    "error": f"Company {company_id} not found",
                    "total_schedules": 0,
                    "schedules": []
                }
            
            response.raise_for_status()
            all_schedules = response.json()
            
            # Filter for employee
            employee_schedules = [
                s for s in all_schedules 
                if s.get("personId") == person_id
            ]
            
            return {
                "company_id": company_id,
                "person_id": person_id,
                "total_schedules": len(employee_schedules),
                "schedules": employee_schedules,
                "timestamp": datetime.now().isoformat()
            }
            
        except httpx.RequestError as e:
            raise RuntimeError(f"Network error: {str(e)}. Is the API server running on localhost:5182?")
        except Exception as e:
            raise RuntimeError(f"API error: {str(e)}")

    async def _get_people_with_unpublished_schedules_impl(self, arguments: dict) -> dict:
        """Implementation for listing people with unpublished schedules"""
        company_id = arguments.get("company_id")
        start_date = arguments.get("start_date")
        end_date = arguments.get("end_date")

        if not company_id:
            raise ValueError("company_id is required")

        try:
            client = await self._get_http_client()

            params = {}
            if start_date:
                params["startDate"] = start_date
            if end_date:
                params["endDate"] = end_date

            response = await client.get(
                f"/api/companies/{company_id}/people/unpublished-schedules",
                params=params
            )

            if response.status_code == 404:
                return {
                    "company_id": company_id,
                    "total_people": 0,
                    "people": [],
                    "message": "No people with unpublished schedules found"
                }

            response.raise_for_status()
            people = response.json()

            return {
                "company_id": company_id,
                "total_people": len(people),
                "people": people,
                "timestamp": datetime.now().isoformat()
            }
        except httpx.RequestError as e:
            raise RuntimeError(f"Network error: {str(e)}. Is the API server running on localhost:5182?")
        except Exception as e:
            raise RuntimeError(f"API error: {str(e)}")
    
    def _setup_http_routes(self):
        """Setup HTTP routes"""
        self.routes = web.RouteTableDef()
        
        # Health check endpoint
        @self.routes.get('/health')
        async def health_check(request):
            """Health check endpoint"""
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
            """Ping endpoint"""
            return web.json_response({
                "message": "pong - server is running",
                "timestamp": datetime.now().isoformat()
            })
        
        # Get employee schedules endpoint
        @self.routes.get('/api/employees/{company_id}/{person_id}/schedules')
        async def get_schedules_endpoint(request):
            """Get employee schedules via HTTP GET"""
            company_id = request.match_info['company_id']
            person_id = request.match_info['person_id']
            
            try:
                result = await self._get_employee_schedules_impl({
                    "company_id": company_id,
                    "person_id": person_id
                })
                return web.json_response(result)
            except Exception as e:
                logger.error(f"HTTP endpoint error: {e}")
                return web.json_response(
                    {"error": str(e), "timestamp": datetime.now().isoformat()},
                    status=500
                )
        
        # POST endpoint for schedules (with JSON body)
        @self.routes.post('/api/employees/schedules')
        async def post_schedules_endpoint(request):
            """Get employee schedules via HTTP POST with JSON body"""
            try:
                data = await request.json()
                result = await self._get_employee_schedules_impl(data)
                return web.json_response(result)
            except json.JSONDecodeError:
                return web.json_response(
                    {"error": "Invalid JSON in request body"},
                    status=400
                )
            except Exception as e:
                logger.error(f"HTTP POST endpoint error: {e}")
                return web.json_response(
                    {"error": str(e), "timestamp": datetime.now().isoformat()},
                    status=500
                )

        # Get people with unpublished schedules
        @self.routes.get('/api/companies/{company_id}/people/unpublished-schedules')
        async def get_people_with_unpublished_schedules_endpoint(request):
            """List people who have unpublished schedules"""
            company_id = request.match_info['company_id']
            start_date = request.query.get('startDate')
            end_date = request.query.get('endDate')

            try:
                result = await self._get_people_with_unpublished_schedules_impl({
                    "company_id": company_id,
                    "start_date": start_date,
                    "end_date": end_date
                })
                return web.json_response(result)
            except Exception as e:
                logger.error(f"HTTP endpoint error: {e}")
                return web.json_response(
                    {"error": str(e), "timestamp": datetime.now().isoformat()},
                    status=500
                )
        
        # MCP tools endpoint
        @self.routes.get('/api/tools')
        async def list_tools_endpoint(request):
            """List available MCP tools via HTTP"""
            tools = [
                {
                    "name": "get_employee_schedules",
                    "description": "Get all schedules for a specific employee",
                    "parameters": {
                        "company_id": "string (required)",
                        "person_id": "string (required)"
                    }
                },
                {
                    "name": "get_people_with_unpublished_schedules",
                    "description": "List people who have unpublished schedules",
                    "parameters": {
                        "company_id": "string (required)",
                        "start_date": "string (optional, ISO date/time)",
                        "end_date": "string (optional, ISO date/time)"
                    }
                },
                {
                    "name": "ping",
                    "description": "Test server connectivity",
                    "parameters": {}
                }
            ]
            return web.json_response({
                "tools": tools,
                "total_tools": len(tools),
                "timestamp": datetime.now().isoformat()
            })
        
        # Generic tool execution endpoint
        @self.routes.post('/api/tools/execute')
        async def execute_tool_endpoint(request):
            """Execute MCP tool via HTTP POST"""
            try:
                data = await request.json()
                tool_name = data.get("tool_name") or data.get("name")
                arguments = data.get("arguments", {})
                
                if not tool_name:
                    return web.json_response(
                        {"error": "tool_name is required"},
                        status=400
                    )
                
                if tool_name == "ping":
                    result = {"message": "pong - server is running"}
                elif tool_name == "get_employee_schedules":
                    result = await self._get_employee_schedules_impl(arguments)
                elif tool_name == "get_people_with_unpublished_schedules":
                    result = await self._get_people_with_unpublished_schedules_impl(arguments)
                else:
                    return web.json_response(
                        {"error": f"Unknown tool: {tool_name}"},
                        status=404
                    )
                
                return web.json_response({
                    "tool_name": tool_name,
                    "result": result,
                    "timestamp": datetime.now().isoformat()
                })
                
            except json.JSONDecodeError:
                return web.json_response(
                    {"error": "Invalid JSON in request body"},
                    status=400
                )
            except Exception as e:
                logger.error(f"Tool execution error: {e}")
                return web.json_response(
                    {"error": str(e), "timestamp": datetime.now().isoformat()},
                    status=500
                )
    
    async def _create_http_app(self):
        """Create HTTP application"""
        app = web.Application()
        
        # Add CORS support
        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Add routes
        app.add_routes(self.routes)
        
        # Add CORS to all routes
        for route in list(app.router.routes()):
            cors.add(route)
        
        return app
    
    async def run_http_server(self):
        """Run HTTP server"""
        try:
            self.http_app = await self._create_http_app()
            runner = web.AppRunner(self.http_app)
            await runner.setup()
            
            site = web.TCPSite(runner, 'localhost', self.http_port)
            await site.start()
            
            logger.info(f"HTTP server started on http://localhost:{self.http_port}")
            logger.info("Available endpoints:")
            logger.info(f"  GET  /health - Health check")
            logger.info(f"  GET  /ping - Ping test")
            logger.info(f"  GET  /api/tools - List available tools")
            logger.info(f"  GET  /api/employees/{{company_id}}/{{person_id}}/schedules - Get schedules")
            logger.info(f"  POST /api/employees/schedules - Get schedules (JSON body)")
            logger.info(f"  GET  /api/companies/{{company_id}}/people/unpublished-schedules - List people with unpublished schedules")
            logger.info(f"  POST /api/tools/execute - Execute any tool")
            
            return runner
            
        except Exception as e:
            logger.error(f"Failed to start HTTP server: {e}")
            raise
    
    async def run_mcp_server(self):
        """Run MCP server"""
        logger.info("Starting MCP Server (stdio mode)...")
        
        try:
            async with stdio_server() as (read_stream, write_stream):
                await self.server.run(
                    read_stream,
                    write_stream,
                    InitializationOptions(
                        server_name="shiftwork-server",
                        server_version="1.0.0",
                        capabilities=self.server.get_capabilities(
                            notification_options=NotificationOptions(),
                            experimental_capabilities={},
                        ),
                    ),
                )
        except Exception as e:
            logger.error(f"MCP server error: {e}", exc_info=True)
            raise
    
    async def run_both_servers(self):
        """Run both HTTP and MCP servers concurrently"""
        logger.info(f"Starting ShiftWork Server with HTTP on port {self.http_port}...")
        
        try:
            # Start HTTP server
            http_runner = await self.run_http_server()
            
            logger.info("Both servers running. Press Ctrl+C to stop.")
            
            # Keep servers running
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
        """Run only HTTP server"""
        logger.info(f"Starting HTTP-only ShiftWork Server on port {self.http_port}...")
        
        try:
            # Start HTTP server
            http_runner = await self.run_http_server()
            
            logger.info("HTTP server running. Press Ctrl+C to stop.")
            
            # Keep server running
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
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ShiftWork MCP Server')
    parser.add_argument('--port', type=int, default=8080, help='HTTP server port (default: 8080)')
    parser.add_argument('--mode', choices=['http', 'mcp', 'both'], default='http', 
                       help='Server mode: http (HTTP only), mcp (MCP only), both (default: http)')
    
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