#!/usr/bin/env python3
"""
Simplified MCP server for debugging
"""

import asyncio
import json
import logging
from typing import List

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel import NotificationOptions


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create server instance
server = Server("shiftwork-test")

@server.list_tools()
async def list_tools() -> List[Tool]:
    """List available tools"""
    logger.info("Tools list requested")
    return [
        Tool(
            name="ping",
            description="Simple ping test",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> List[TextContent]:
    """Handle tool calls"""
    logger.info(f"Tool called: {name} with args: {arguments}")
    
    if name == "ping":
        return [TextContent(type="text", text="pong")]
    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]

async def main():
    """Main server function"""
    logger.info("Starting simplified MCP server...")
    
    try:
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="example-server",
                    server_version="0.1.0",
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    asyncio.run(main())