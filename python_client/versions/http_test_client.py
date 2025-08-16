#!/usr/bin/env python3
"""
HTTP test client - simulates HTTP requests to test MCP functionality
This doesn't actually use HTTP, but provides the same interface as your original client
"""

import asyncio
import json
import subprocess
import sys
from typing import Dict, Any, Optional

class MCPHTTPClient:
    """MCP client that simulates HTTP interface"""
    
    def __init__(self, server_script: str = "compatible_mcp_server.py"):
        self.server_script = server_script
        self.process = None
        self.request_id = 0
        self.initialized = False
    
    async def start(self):
        """Start the MCP server"""
        self.process = await asyncio.create_subprocess_exec(
            sys.executable, self.server_script,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Initialize the server
        await self._initialize()
        
    async def _initialize(self):
        """Initialize MCP session"""
        if self.initialized:
            return
            
        # Send initialize
        init_response = await self._send_request({
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize", 
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "http-test-client", "version": "1.0.0"}
            }
        })
        
        if "error" in init_response:
            raise Exception(f"Initialization failed: {init_response['error']}")
        
        # Send initialized notification
        await self._send_request({"jsonrpc": "2.0", "method": "initialized"})
        self.initialized = True
    
    def _next_id(self) -> int:
        self.request_id += 1
        return self.request_id
    
    async def _send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send request to MCP server"""
        if not self.process:
            raise Exception("Server not started")
        
        request_json = json.dumps(request) + "\n"
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read response (skip if it's a notification)
        if "id" in request:
            response_line = await asyncio.wait_for(self.process.stdout.readline(), timeout=10)
            return json.loads(response_line.decode().strip())
        else:
            return {}  # No response for notifications
    
    async def get_context(self) -> Dict[str, Any]:
        """Get available tools (simulates GET /mcp/context)"""
        response = await self._send_request({
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/list",
            "params": {}  # Add empty params
        })
        
        if "error" in response:
            raise Exception(f"Failed to get context: {response['error']}")
        
        tools = response.get("result", {}).get("tools", [])
        
        # Convert to HTTP-like format
        return {
            "tools": [
                {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["inputSchema"]["properties"]
                }
                for tool in tools
            ]
        }
    
    async def execute_action(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool (simulates POST /mcp/actions)"""
        response = await self._send_request({
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": parameters
            }
        })
        
        if "error" in response:
            return {"success": False, "error": response["error"]["message"]}
        
        # Extract text content
        content = response.get("result", {}).get("content", [])
        if content and len(content) > 0:
            text = content[0].get("text", "")
            
            # Try to parse as JSON if possible
            try:
                data = json.loads(text)
                return {"success": True, "data": data}
            except json.JSONDecodeError:
                return {"success": True, "data": text}
        else:
            return {"success": False, "error": "No content returned"}
    
    async def stop(self):
        """Stop the server"""
        if self.process:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

# Your original client code, adapted
async def main():
    """
    A client to interact with the MCP server (HTTP-style interface)
    """
    client = MCPHTTPClient()
    
    try:
        # Start the server
        print("🚀 Starting MCP server...")
        await client.start()
        
        # 1. Discover available tools
        print("📋 Discovering tools...")
        try:
            context = await client.get_context()
            print("Available Tools:")
            print(json.dumps(context['tools'], indent=2))
        except Exception as e:
            print(f"Error discovering tools: {e}")
            return
        
        # 2. Execute the 'get_employee_schedules' tool
        tool_name = "get_employee_schedules"
        company_id = "6513451"  # Replace with a valid company ID
        person_id = "6"         # Replace with a valid person ID
        
        print(f"\n🔧 Executing tool: {tool_name}...")
        try:
            result = await client.execute_action(tool_name, {
                "company_id": company_id,
                "person_id": person_id,
            })
            
            print("\nTool Result:")
            print(json.dumps(result, indent=2))
            
        except Exception as e:
            print(f"Error executing tool: {e}")
        
        # 3. Test the ping tool
        print(f"\n🏓 Testing ping tool...")
        try:
            result = await client.execute_action("ping", {})
            print("Ping Result:")
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error testing ping: {e}")
            
    finally:
        print("🛑 Stopping server...")
        await client.stop()

if __name__ == "__main__":
    asyncio.run(main())