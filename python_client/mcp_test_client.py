#!/usr/bin/env python3
"""
Fixed HTTP-style test client for MCP server
"""

import asyncio
import json
import subprocess
import sys
from typing import Dict, Any

class FixedMCPClient:
    """Fixed MCP client with proper protocol handling"""
    
    def __init__(self, server_script: str = "mcp_server.py"):
        self.server_script = server_script
        self.process = None
        self.request_id = 0
        self.initialized = False
    
    async def start(self):
        """Start the MCP server"""
        print("🔧 Starting MCP server process...")
        self.process = await asyncio.create_subprocess_exec(
            sys.executable, self.server_script,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Give server time to start
        await asyncio.sleep(0.5)
        
        # Initialize
        await self._initialize()
        print("✅ Server initialized successfully")
        
    async def _initialize(self):
        """Initialize MCP session"""
        if self.initialized:
            return
        
        print("📡 Initializing MCP session...")
        
        # Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "test", "version": "1.0.0"}
            }
        }
        
        init_response = await self._send_request(init_request)
        
        if "error" in init_response:
            raise Exception(f"Initialize failed: {init_response['error']}")
        
        print(f"   Server info: {init_response.get('result', {}).get('serverInfo', {})}")
        
        # Send initialized notification
        await self._send_notification({"jsonrpc": "2.0", "method": "initialized"})
        
        self.initialized = True
    
    def _next_id(self) -> int:
        self.request_id += 1
        return self.request_id
    
    async def _send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send request and wait for response"""
        if not self.process:
            raise Exception("Server not started")
        
        request_json = json.dumps(request) + "\n"
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read response
        try:
            response_line = await asyncio.wait_for(
                self.process.stdout.readline(), 
                timeout=15.0
            )
            if not response_line:
                raise Exception("Server closed connection")
            
            response_text = response_line.decode().strip()
            if not response_text:
                raise Exception("Empty response from server")
            
            return json.loads(response_text)
            
        except asyncio.TimeoutError:
            raise Exception("Timeout waiting for server response")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response: {e}")
    
    async def _send_notification(self, notification: Dict[str, Any]):
        """Send notification (no response expected)"""
        notification_json = json.dumps(notification) + "\n"
        self.process.stdin.write(notification_json.encode())
        await self.process.stdin.drain()
        # Small delay to let server process
        await asyncio.sleep(0.1)
    
    async def get_context(self) -> Dict[str, Any]:
        """Get available tools"""
        print("📋 Requesting tools list...")
        
        response = await self._send_request({
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/list"
        })
        
        if "error" in response:
            raise Exception(f"tools/list failed: {response['error']}")
        
        tools = response.get("result", {}).get("tools", [])
        print(f"   Found {len(tools)} tools")
        
        # Convert to HTTP-like format
        return {
            "tools": [
                {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["inputSchema"].get("properties", {})
                }
                for tool in tools
            ]
        }
    
    async def execute_action(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool"""
        print(f"🔧 Executing tool: {tool_name}")
        
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
            return {
                "success": False, 
                "error": response["error"].get("message", "Unknown error")
            }
        
        # Extract content
        result = response.get("result", {})
        content = result.get("content", [])
        
        if content and len(content) > 0:
            text = content[0].get("text", "")
            
            # Try to parse as JSON
            try:
                data = json.loads(text)
                if isinstance(data, dict) and "success" in data:
                    return data  # Already in the right format
                else:
                    return {"success": True, "data": data}
            except json.JSONDecodeError:
                return {"success": True, "data": text}
        else:
            return {"success": False, "error": "No content returned"}
    
    async def stop(self):
        """Stop the server"""
        if self.process:
            print("🛑 Stopping server...")
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                print("   Force killing server...")
                self.process.kill()
                await self.process.wait()
    
    async def get_stderr(self) -> str:
        """Get any stderr output from server"""
        if self.process and self.process.stderr:
            try:
                stderr_data = await asyncio.wait_for(
                    self.process.stderr.read(), 
                    timeout=0.5
                )
                return stderr_data.decode() if stderr_data else ""
            except:
                return ""
        return ""

async def main():
    """Test the MCP server with HTTP-like interface"""
    client = FixedMCPClient()
    
    try:
        # Start server
        await client.start()
        
        # Test 1: Get available tools
        print("\n" + "="*50)
        print("TEST 1: Discovering available tools")
        print("="*50)
        
        try:
            context = await client.get_context()
            print("✅ Available Tools:")
            for tool in context['tools']:
                print(f"   • {tool['name']}: {tool['description']}")
                if tool['parameters']:
                    print(f"     Parameters: {list(tool['parameters'].keys())}")
        except Exception as e:
            print(f"❌ Error getting tools: {e}")
            stderr = await client.get_stderr()
            if stderr:
                print(f"Server stderr: {stderr}")
            return
        
        # Test 2: Ping tool
        print("\n" + "="*50)
        print("TEST 2: Testing ping tool")
        print("="*50)
        
        try:
            result = await client.execute_action("ping", {})
            print(f"✅ Ping result: {json.dumps(result, indent=2)}")
        except Exception as e:
            print(f"❌ Ping failed: {e}")
        
        # Test 3: Employee schedules tool
        print("\n" + "="*50)
        print("TEST 3: Testing get_employee_schedules")
        print("="*50)
        
        try:
            result = await client.execute_action("get_employee_schedules", {
                "company_id": "6513451",
                "person_id": "6"
            })
            
            print("📅 Schedule result:")
            if result.get("success"):
                # Pretty print the result
                data = result.get("data", result)
                if isinstance(data, dict):
                    print(json.dumps(data, indent=2)[:500] + "..." if len(str(data)) > 500 else json.dumps(data, indent=2))
                else:
                    print(str(data)[:500] + "..." if len(str(data)) > 500 else data)
            else:
                print(f"❌ Error: {result.get('error', 'Unknown error')}")
            
        except Exception as e:
            print(f"❌ Schedule test failed: {e}")
        
        print("\n🎉 All tests completed!")
        
    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        stderr = await client.get_stderr()
        if stderr:
            print(f"\nServer stderr output:\n{stderr}")
    finally:
        await client.stop()

if __name__ == "__main__":
    asyncio.run(main())