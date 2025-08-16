#!/usr/bin/env python3
"""
Simple tester for MCP server using subprocess communication
"""

import subprocess
import json
import asyncio
from typing import Dict, Any

class SimpleMCPTester:
    """Simple tester for MCP servers using subprocess"""
    
    def __init__(self, server_script: str):
        self.server_script = server_script
        self.process = None
    
    async def start_server(self):
        """Start the MCP server process"""
        self.process = await asyncio.create_subprocess_exec(
            "python", self.server_script,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        print("🚀 Server started")
    
    async def send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send a request to the server"""
        if not self.process:
            raise RuntimeError("Server not started")
        
        # Send request
        request_json = json.dumps(request) + "\n"
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read response
        response_line = await self.process.stdout.readline()
        if not response_line:
            raise RuntimeError("No response from server")
        
        return json.loads(response_line.decode())
    
    async def initialize(self):
        """Initialize the MCP session"""
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }
        
        response = await self.send_request(init_request)
        print("✅ Initialized:", response)
        return response
    
    async def list_tools(self):
        """List available tools"""
        request = {
            "jsonrpc": "2.0", 
            "id": 2,
            "method": "tools/list"
        }
        
        response = await self.send_request(request)
        print("📋 Available tools:")
        if "result" in response and "tools" in response["result"]:
            for tool in response["result"]["tools"]:
                print(f"  • {tool['name']}: {tool['description']}")
        return response
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]):
        """Call a specific tool"""
        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        response = await self.send_request(request)
        print(f"🔧 Tool '{tool_name}' result:")
        if "result" in response:
            print(json.dumps(response["result"], indent=2))
        else:
            print("Error:", response.get("error", "Unknown error"))
        return response
    
    async def stop_server(self):
        """Stop the server process"""
        if self.process:
            self.process.terminate()
            await self.process.wait()
            print("🛑 Server stopped")

async def test_server():
    """Test the MCP server"""
    tester = SimpleMCPTester("main.py")  # Path to your server script
    
    try:
        # Start server
        await tester.start_server()
        await asyncio.sleep(1)  # Give server time to start
        
        # Initialize
        await tester.initialize()
        
        # List tools
        await tester.list_tools()
        
        # Test tools
        print("\n" + "="*50)
        
        # Test 1: Get employee schedules
        await tester.call_tool("get_employee_schedules", {
            "company_id": "6513451",
            "person_id": "6"
        })
        
        print("\n" + "-"*30)
        
        # Test 2: Get company schedules  
        await tester.call_tool("get_company_schedules", {
            "company_id": "6513451"
        })
        
        print("\n" + "-"*30)
        
        # Test 3: Get schedule details
        await tester.call_tool("get_schedule_details", {
            "company_id": "6513451", 
            "schedule_id": "some_schedule_id"
        })
        
    except Exception as e:
        print(f"❌ Test error: {e}")
    finally:
        await tester.stop_server()

if __name__ == "__main__":
    asyncio.run(test_server())