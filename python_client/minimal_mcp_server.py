#!/usr/bin/env python3
"""
Minimal MCP server for debugging
"""

import asyncio
import logging
from typing import List

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the server
server = Server("minimal-test-server")

@server.list_tools()
async def list_tools() -> List[Tool]:
    """Return available tools"""
    logger.info("list_tools called")
    return [
        Tool(
            name="ping",
            description="Simple ping test",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="echo",
            description="Echo back the input",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Message to echo"
                    }
                },
                "required": ["message"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> List[TextContent]:
    """Handle tool calls"""
    logger.info(f"call_tool: name={name}, arguments={arguments}")
    
    try:
        if name == "ping":
            return [TextContent(type="text", text="pong - server is working!")]
        
        elif name == "echo":
            message = arguments.get("message", "")
            return [TextContent(type="text", text=f"Echo: {message}")]
        
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
            
    except Exception as e:
        logger.error(f"Error in call_tool: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def main():
    """Main server function"""
    logger.info("Starting minimal MCP server...")
    
    try:
        async with stdio_server() as streams:
            logger.info("Server ready, waiting for connections...")
            await server.run(*streams)
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        exit(1)