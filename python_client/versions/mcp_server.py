#!/usr/bin/env python3
"""
Fixed MCP server with proper protocol handling
"""

import asyncio
import json
import logging
import sys
from typing import List, Any, Dict

import httpx
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

class FixedShiftWorkServer:
    def __init__(self):
        logger.info("Initializing FixedShiftWorkServer")
        self.server = Server("shiftwork-server")
        self.http_client = None
        self._setup_handlers()
    
    async def _get_http_client(self):
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(
                base_url="http://localhost:5182",
                timeout=30.0
            )
            logger.info("Created HTTP client")
        return self.http_client
    
    def _setup_handlers(self):
        logger.info("Setting up handlers")
        
        @self.server.list_tools()
        async def handle_list_tools() -> List[Tool]:
            logger.info("Handling list_tools request")
            tools = [
                Tool(
                    name="ping",
                    description="Test server connectivity",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                ),
                Tool(
                    name="get_employee_schedules",
                    description="Get all schedules for a specific employee",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company_id": {
                                "type": "string",
                                "description": "The ID of the company"
                            },
                            "person_id": {
                                "type": "string",
                                "description": "The ID of the employee"
                            }
                        },
                        "required": ["company_id", "person_id"]
                    }
                )
            ]
            logger.info(f"Returning {len(tools)} tools")
            return tools
        
        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict) -> List[TextContent]:
            logger.info(f"Handling call_tool request: name={name}, args={arguments}")
            
            try:
                if name == "ping":
                    logger.info("Executing ping tool")
                    return [TextContent(type="text", text="pong - server is running")]
                
                elif name == "get_employee_schedules":
                    logger.info("Executing get_employee_schedules tool")
                    return await self._get_employee_schedules(arguments)
                
                else:
                    error_msg = f"Unknown tool: {name}"
                    logger.error(error_msg)
                    return [TextContent(type="text", text=error_msg)]
                    
            except Exception as e:
                error_msg = f"Error executing tool {name}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                return [TextContent(type="text", text=error_msg)]
    
    async def _get_employee_schedules(self, arguments: dict) -> List[TextContent]:
        """Get employee schedules"""
        company_id = arguments.get("company_id")
        person_id = arguments.get("person_id")
        
        logger.info(f"Getting schedules for company={company_id}, person={person_id}")
        
        if not company_id:
            return [TextContent(type="text", text="Error: company_id is required")]
        if not person_id:
            return [TextContent(type="text", text="Error: person_id is required")]
        
        try:
            client = await self._get_http_client()
            url = f"/api/companies/{company_id}/schedules"
            logger.info(f"Making request to: {url}")
            
            response = await client.get(url)
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code == 404:
                return [TextContent(
                    type="text",
                    text=f"Company {company_id} not found (HTTP 404)"
                )]
            
            response.raise_for_status()
            all_schedules = response.json()
            
            # Filter for the specific employee
            employee_schedules = [
                schedule for schedule in all_schedules
                if str(schedule.get("personId")) == str(person_id)
            ]
            
            logger.info(f"Found {len(employee_schedules)} schedules for employee")
            
            result = {
                "success": True,
                "company_id": company_id,
                "person_id": person_id,
                "total_schedules": len(employee_schedules),
                "schedules": employee_schedules
            }
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
            
        except httpx.ConnectError:
            error_msg = "Cannot connect to API server at localhost:5182. Is the ShiftWork API running?"
            logger.error(error_msg)
            return [TextContent(type="text", text=error_msg)]
            
        except httpx.HTTPStatusError as e:
            error_msg = f"API returned HTTP {e.response.status_code}: {e.response.text}"
            logger.error(error_msg)
            return [TextContent(type="text", text=error_msg)]
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return [TextContent(type="text", text=error_msg)]
    
    async def run(self):
        """Run the MCP server"""
        logger.info("Starting MCP server...")
        try:
            async with stdio_server() as (read_stream, write_stream):
                logger.info("stdio_server created, starting server.run()")
                
                # Create proper notification options
                from mcp.server.models import NotificationOptions
                
                notification_options = NotificationOptions()
                
                # Try different ways to get capabilities for compatibility
                try:
                    capabilities = self.server.get_capabilities(
                        notification_options=notification_options,
                        experimental_capabilities={}
                    )
                except (TypeError, AttributeError):
                    try:
                        capabilities = self.server.get_capabilities()
                    except:
                        # Fallback: create minimal capabilities manually
                        from mcp.types import ServerCapabilities, ToolsCapability
                        capabilities = ServerCapabilities(
                            tools=ToolsCapability()
                        )
                
                init_options = InitializationOptions(
                    server_name="shiftwork-server",
                    server_version="1.0.0",
                    capabilities=capabilities
                )
                
                await self.server.run(read_stream, write_stream, init_options)
                
        except Exception as e:
            logger.error(f"Server error: {e}", exc_info=True)
            raise
        finally:
            logger.info("Server shutting down...")
            if self.http_client:
                try:
                    await self.http_client.aclose()
                    logger.info("HTTP client closed")
                except Exception as e:
                    logger.error(f"Error closing HTTP client: {e}")

async def main():
    server = FixedShiftWorkServer()
    try:
        await server.run()
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.error(f"Server failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())