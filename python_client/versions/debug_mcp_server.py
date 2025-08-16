#!/usr/bin/env python3
"""
Debug version of ShiftWork MCP Server with extensive logging
"""

import json
import logging
import sys
import traceback
from typing import Any, Dict, List
import asyncio

import httpx
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr),
        logging.FileHandler('mcp_server.log')
    ]
)
logger = logging.getLogger(__name__)

class DebugShiftWorkServer:
    """Debug version of ShiftWork MCP Server"""
    
    def __init__(self):
        logger.info("Initializing DebugShiftWorkServer")
        self.server = Server("shiftwork-debug-server")
        self.http_client = None
        self._setup_handlers()
    
    async def _get_http_client(self):
        """Get or create HTTP client"""
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(
                base_url="http://localhost:5182",
                timeout=30.0
            )
            logger.info("Created HTTP client")
        return self.http_client
    
    def _setup_handlers(self):
        """Setup MCP server handlers with debug logging"""
        logger.info("Setting up handlers")
        
        @self.server.list_tools()
        async def handle_list_tools() -> List[Tool]:
            """List available tools"""
            logger.info("handle_list_tools called")
            try:
                tools = [
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
                    ),
                    Tool(
                        name="test_connection",
                        description="Test connection to the API",
                        inputSchema={
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    )
                ]
                logger.info(f"Returning {len(tools)} tools")
                return tools
            except Exception as e:
                logger.error(f"Error in handle_list_tools: {e}", exc_info=True)
                raise
        
        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict) -> List[TextContent]:
            """Handle tool calls with extensive debugging"""
            logger.info(f"handle_call_tool called with name='{name}', arguments={arguments}")
            
            try:
                if name == "test_connection":
                    return await self._test_connection()
                elif name == "get_employee_schedules":
                    return await self._get_employee_schedules(arguments)
                else:
                    error_msg = f"Unknown tool: {name}"
                    logger.error(error_msg)
                    return [TextContent(type="text", text=error_msg)]
                    
            except Exception as e:
                error_msg = f"Error in handle_call_tool: {str(e)}"
                logger.error(error_msg, exc_info=True)
                return [TextContent(type="text", text=error_msg)]
    
    async def _test_connection(self) -> List[TextContent]:
        """Test basic connectivity"""
        logger.info("Testing connection")
        try:
            client = await self._get_http_client()
            
            # Try a simple request to test connectivity
            response = await client.get("/")
            logger.info(f"Test connection response status: {response.status_code}")
            
            return [TextContent(
                type="text",
                text=f"Connection test successful. Status: {response.status_code}"
            )]
        except Exception as e:
            error_msg = f"Connection test failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return [TextContent(type="text", text=error_msg)]
    
    async def _get_employee_schedules(self, args: dict) -> List[TextContent]:
        """Get employee schedules with debug logging"""
        logger.info(f"_get_employee_schedules called with args: {args}")
        
        try:
            company_id = args.get("company_id")
            person_id = args.get("person_id")
            
            if not company_id:
                return [TextContent(type="text", text="Error: company_id is required")]
            if not person_id:
                return [TextContent(type="text", text="Error: person_id is required")]
            
            logger.info(f"Making request for company_id={company_id}, person_id={person_id}")
            
            client = await self._get_http_client()
            url = f"/api/companies/{company_id}/schedules"
            logger.info(f"Making GET request to: {url}")
            
            response = await client.get(url)
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code == 404:
                return [TextContent(
                    type="text", 
                    text=f"Company {company_id} not found (404)"
                )]
            
            response.raise_for_status()
            schedules = response.json()
            logger.info(f"Retrieved {len(schedules)} schedules")
            
            # Filter for employee
            employee_schedules = [
                schedule for schedule in schedules 
                if schedule.get("personId") == person_id
            ]
            
            logger.info(f"Found {len(employee_schedules)} schedules for employee {person_id}")
            
            if not employee_schedules:
                return [TextContent(
                    type="text",
                    text=f"No schedules found for employee {person_id} in company {company_id}"
                )]
            
            result = {
                "employee_id": person_id,
                "company_id": company_id,
                "schedule_count": len(employee_schedules),
                "schedules": employee_schedules
            }
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
            logger.error(error_msg)
            return [TextContent(type="text", text=error_msg)]
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return [TextContent(type="text", text=error_msg)]
    
    async def run(self):
        """Run the server with comprehensive error handling"""
        logger.info("Starting debug MCP server")
        
        try:
            logger.info("Creating stdio server")
            async with stdio_server() as (read_stream, write_stream):
                logger.info("stdio_server created successfully")
                
                init_options = InitializationOptions(
                    server_name="shiftwork-debug-server",
                    server_version="1.0.0-debug",
                    capabilities=self.server.get_capabilities(
                        notification_options=None,
                        experimental_capabilities=None
                    )
                )
                logger.info(f"Starting server with options: {init_options}")
                
                await self.server.run(read_stream, write_stream, init_options)
                
        except KeyboardInterrupt:
            logger.info("Server interrupted by user")
        except Exception as e:
            logger.error(f"Server error: {str(e)}", exc_info=True)
            # Print to stderr as well for immediate visibility
            print(f"FATAL ERROR: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise
        finally:
            logger.info("Cleaning up...")
            if self.http_client:
                try:
                    await self.http_client.aclose()
                    logger.info("HTTP client closed")
                except Exception as e:
                    logger.error(f"Error closing HTTP client: {e}")

async def main():
    """Main entry point with error handling"""
    try:
        logger.info("Starting main()")
        server = DebugShiftWorkServer()
        await server.run()
    except Exception as e:
        logger.error(f"Fatal error in main(): {e}", exc_info=True)
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    logger.info("Script started")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Script interrupted")
        print("Interrupted", file=sys.stderr)
    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        print(f"Script failed: {e}", file=sys.stderr)
        sys.exit(1)