#!/usr/bin/env python3
"""
Fixed MCP server for ShiftWork API
"""

import asyncio
import json
import logging
import sys
from typing import List
import inspect

import httpx
from mcp.server.lowlevel import NotificationOptions, Server
#from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ShiftWorkServer:
    def __init__(self):
        self.server = Server("shiftwork-server")
        self.http_client = None
        self._setup_handlers()
    
    async def _get_http_client(self):
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(
                base_url="http://localhost:5182",
                timeout=30.0
            )
        return self.http_client
    
    def _setup_handlers(self):
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            logger.info("list_tools called")
            return [
                Tool(
                    name="get_employee_schedules",
                    description="Get all schedules for a specific employee",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company_id": {"type": "string", "description": "Company ID"},
                            "person_id": {"type": "string", "description": "Employee ID"}
                        },
                        "required": ["company_id", "person_id"]
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
                    company_id = arguments.get("company_id")
                    person_id = arguments.get("person_id")
                    
                    if not company_id or not person_id:
                        return [TextContent(
                            type="text", 
                            text="Error: Both company_id and person_id are required"
                        )]
                    
                    try:
                        client = await self._get_http_client()
                        response = await client.get(f"/api/companies/{company_id}/schedules")
                        
                        if response.status_code == 404:
                            return [TextContent(
                                type="text",
                                text=f"Company {company_id} not found"
                            )]
                        
                        response.raise_for_status()
                        all_schedules = response.json()
                        
                        # Filter for employee
                        employee_schedules = [
                            s for s in all_schedules 
                            if s.get("personId") == person_id
                        ]
                        
                        result = {
                            "company_id": company_id,
                            "person_id": person_id,
                            "total_schedules": len(employee_schedules),
                            "schedules": employee_schedules
                        }
                        
                        return [TextContent(
                            type="text",
                            text=json.dumps(result, indent=2)
                        )]
                        
                    except httpx.RequestError as e:
                        return [TextContent(
                            type="text",
                            text=f"Network error: {str(e)}. Is the API server running on localhost:5182?"
                        )]
                    except Exception as e:
                        return [TextContent(
                            type="text",
                            text=f"API error: {str(e)}"
                        )]
                
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
                    
            except Exception as e:
                logger.error(f"Tool error: {e}", exc_info=True)
                return [TextContent(type="text", text=f"Server error: {str(e)}")]
            
    def _get_capabilities_safely(self):
        """Get capabilities with version compatibility"""
        try:
            # Try the new signature first
            sig = inspect.signature(self.server.get_capabilities)
            params = sig.parameters
            
            if len(params) >= 2:  # New version with required params
                return self.server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities=None
                )
            else:  # Old version with no params
                return self.server.get_capabilities()
                
        except Exception as e:
            logger.warning(f"Could not determine capabilities signature: {e}")
            # Fallback - try both ways
            try:
                return self.server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities=None
                )
            except:
                try:
                    return self.server.get_capabilities()
                except:
                    # Last resort - return empty capabilities
                    return {}
    
    async def run(self):
        logger.info("Starting ShiftWork MCP Server...")
        
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
        except KeyboardInterrupt:
            logger.info("Server stopped by user")
        except Exception as e:
            logger.error(f"Server error: {e}", exc_info=True)
            raise
        finally:
            if self.http_client:
                await self.http_client.aclose()

async def main():
    server = ShiftWorkServer()
    await server.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server interrupted")
    except Exception as e:
        print(f"Server failed: {e}")
        sys.exit(1)