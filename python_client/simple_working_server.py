#!/usr/bin/env python3
"""
Simple working MCP server that avoids the capabilities issue
"""

import asyncio
import json
import logging
import sys
from typing import List

# First, let's try the FastMCP approach since that was working in your original code
try:
    from mcp.server.fastmcp import FastMCP
    USE_FASTMCP = True
except ImportError:
    USE_FASTMCP = False
    import httpx
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    from mcp.server.models import InitializationOptions
    from mcp.server.lowlevel import NotificationOptions

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

if USE_FASTMCP:
    # Use FastMCP if available (like your original code)
    app = FastMCP("Demo ShiftWork Server")
    

    async def get_schedules_for_employee(company_id: str, person_id: str) -> str:
        """
        Gets all schedules for a given employee from the ShiftWork API.
        """
        base_url = "http://localhost:5182"
        url = f"{base_url}/api/companies/{company_id}/schedules"

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                
                if response.status_code == 404:
                    return json.dumps({
                        "success": False,
                        "error": f"Company {company_id} not found"
                    })
                
                response.raise_for_status()
                schedules = response.json()

                employee_schedules = [
                    schedule for schedule in schedules 
                    if str(schedule.get("personId")) == str(person_id)
                ]

                if employee_schedules:
                    result = {
                        "success": True,
                        "company_id": company_id,
                        "person_id": person_id,
                        "schedule_count": len(employee_schedules),
                        "schedules": employee_schedules
                    }
                    return json.dumps(result, indent=2)
                else:
                    return json.dumps({
                        "success": True,
                        "message": f"No schedules found for employee {person_id} in company {company_id}",
                        "schedule_count": 0,
                        "schedules": []
                    })

        except httpx.ConnectError:
            return json.dumps({
                "success": False,
                "error": "Cannot connect to ShiftWork API at localhost:5182. Is the API server running?"
            })
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"An error occurred: {str(e)}"
            })

    async def ping() -> str:
        """Simple ping test"""
        return json.dumps({"success": True, "message": "pong - server is running"})

    # Register tools with FastMCP
    from mcp import Tool

    get_schedules_tool = Tool(
        name="get_schedules_for_employee",
        description="Gets all schedules for a given employee.",
        inputSchema={
            'type': 'object',
            'properties': {
                'company_id': {"type": "string", "description": "The ID of the company."},
                'person_id': {"type": "string", "description": "The ID of the employee."},
            },
            'required': []
        },
        outputSchema=None,
        annotations=None,
        function=get_schedules_for_employee
    )

    ping_tool = Tool(
        name="ping",
        description="Test server connectivity",
        inputSchema={
            'type': 'object',
            'properties': {},
            'required': [],
        },
        outputSchema=None,
        annotations=None,
        function=ping
    )

    app.add_tool(get_schedules_tool)
    app.add_tool(ping_tool)

    async def main():
        """Run FastMCP server"""
        logger.info("Starting FastMCP server...")
        import uvicorn
        # Use asyncio to run the server
        config = uvicorn.Config(app, host="127.0.0.1", port=0, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()

else:
    # Fallback to standard MCP server with minimal setup
    class SimpleServer:
        def __init__(self):
            self.server = Server("simple-shiftwork-server")
            self.setup_handlers()
        
        def setup_handlers(self):
            @self.server.list_tools()
            async def list_tools() -> List[Tool]:
                return [
                    Tool(
                        name="ping",
                        description="Test server connectivity",
                        inputSchema={"type": "object", "properties": {}, "required": []}
                    )
                ]
            
            @self.server.call_tool()
            async def call_tool(name: str, arguments: dict) -> List[TextContent]:
                if name == "ping":
                    return [TextContent(type="text", text='{"success": true, "message": "pong"}')]
                else:
                    return [TextContent(type="text", text=f'{{"success": false, "error": "Unknown tool: {name}"}}')]
        
        async def run(self):
            logger.info("Starting simple MCP server...")
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

    async def main():
        server = SimpleServer()
        await server.run()

if __name__ == "__main__":
    try:
        if USE_FASTMCP:
            print("Using FastMCP", file=sys.stderr)
        else:
            print("Using standard MCP server", file=sys.stderr)
        
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server interrupted")
    except Exception as e:
        logger.error(f"Server failed: {e}", exc_info=True)
        sys.exit(1)