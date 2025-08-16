#!/usr/bin/env python3
"""
Comprehensive MCP Server Debug Suite
"""

import asyncio
import json
import logging
import subprocess
import sys
from typing import Dict, Any, Optional

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MCPDebugClient:
    """Debug client for MCP server testing"""
    
    def __init__(self, server_script: str = "paste.py"):
        self.server_script = server_script
        self.process = None
        self.request_id = 0
        self.initialized = False
        
    async def start_server(self) -> bool:
        """Start the MCP server process"""
        print("🚀 Starting MCP server...")
        
        try:
            self.process = await asyncio.create_subprocess_exec(
                sys.executable, self.server_script,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                bufsize=0
            )
            
            # Wait a moment for server to start
            await asyncio.sleep(1.0)
            
            # Check if process is still running
            if self.process.returncode is not None:
                stderr_output = await self.process.stderr.read()
                print(f"❌ Server exited immediately with code {self.process.returncode}")
                if stderr_output:
                    print(f"Error output: {stderr_output.decode()}")
                return False
                
            print("✅ Server process started")
            return True
            
        except FileNotFoundError:
            print(f"❌ Could not find server script: {self.server_script}")
            return False
        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            return False
    
    def _next_id(self) -> int:
        """Get next request ID"""
        self.request_id += 1
        return self.request_id
    
    async def send_raw_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Send raw JSON-RPC request"""
        if not self.process or self.process.returncode is not None:
            print("❌ Server process not running")
            return None
        
        try:
            # Send request
            request_json = json.dumps(request) + "\n"
            print(f"📤 Sending: {request_json.strip()}")
            
            self.process.stdin.write(request_json.encode())
            await self.process.stdin.drain()
            
            # Wait for response
            response_line = await asyncio.wait_for(
                self.process.stdout.readline(),
                timeout=10.0
            )
            
            if not response_line:
                print("❌ Server closed connection")
                return None
            
            response_text = response_line.decode().strip()
            print(f"📥 Received: {response_text}")
            
            if not response_text:
                print("❌ Empty response")
                return None
            
            return json.loads(response_text)
            
        except asyncio.TimeoutError:
            print("⏰ Timeout waiting for response")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON response: {e}")
            print(f"Raw response: {response_text}")
            return None
        except Exception as e:
            print(f"❌ Error sending request: {e}")
            return None
    
    async def test_initialize(self) -> bool:
        """Test server initialization"""
        print("\n🔧 Testing initialization...")
        
        init_request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "clientInfo": {
                    "name": "debug-client",
                    "version": "1.0.0"
                }
            }
        }
        
        response = await self.send_raw_request(init_request)
        if not response:
            return False
        
        if "error" in response:
            print(f"❌ Initialize error: {response['error']}")
            return False
        
        print("✅ Initialize successful")
        
        # Send initialized notification
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "initialized"
        }
        
        # Send notification (no response expected)
        try:
            notification_json = json.dumps(initialized_notification) + "\n"
            print(f"📤 Sending notification: {notification_json.strip()}")
            self.process.stdin.write(notification_json.encode())
            await self.process.stdin.drain()
            await asyncio.sleep(0.5)  # Let server process
            print("✅ Initialized notification sent")
        except Exception as e:
            print(f"❌ Failed to send initialized notification: {e}")
        
        self.initialized = True
        return True
    
    async def test_tools_list(self) -> bool:
        """Test tools/list method"""
        print("\n📋 Testing tools/list...")
        
        if not self.initialized:
            print("❌ Not initialized")
            return False
        
        tools_request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/list",
            "params": {}
        }
        
        response = await self.send_raw_request(tools_request)
        if not response:
            return False
        
        if "error" in response:
            print(f"❌ Tools list error: {response['error']}")
            return False
        
        result = response.get("result", {})
        tools = result.get("tools", [])
        print(f"✅ Found {len(tools)} tools:")
        for tool in tools:
            print(f"   • {tool.get('name', 'Unknown')}: {tool.get('description', 'No description')}")
        
        return True
    
    async def test_ping_tool(self) -> bool:
        """Test ping tool call"""
        print("\n🏓 Testing ping tool...")
        
        if not self.initialized:
            print("❌ Not initialized")
            return False
        
        ping_request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {
                "name": "ping",
                "arguments": {}
            }
        }
        
        response = await self.send_raw_request(ping_request)
        if not response:
            return False
        
        if "error" in response:
            print(f"❌ Ping error: {response['error']}")
            return False
        
        result = response.get("result", {})
        content = result.get("content", [])
        
        if content and len(content) > 0:
            text = content[0].get("text", "")
            print(f"✅ Ping response: {text}")
            return True
        else:
            print("❌ No content in ping response")
            return False
    
    async def check_server_stderr(self):
        """Check for any stderr output"""
        if self.process and self.process.stderr:
            try:
                # Non-blocking read
                stderr_data = b""
                while True:
                    try:
                        chunk = await asyncio.wait_for(
                            self.process.stderr.read(1024), 
                            timeout=0.1
                        )
                        if not chunk:
                            break
                        stderr_data += chunk
                    except asyncio.TimeoutError:
                        break
                
                if stderr_data:
                    stderr_text = stderr_data.decode()
                    print(f"\n📝 Server stderr output:\n{stderr_text}")
                    
            except Exception as e:
                print(f"Error reading stderr: {e}")
    
    async def stop_server(self):
        """Stop the server process"""
        if self.process:
            print("🛑 Stopping server...")
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                print("Force killing server...")
                self.process.kill()
                await self.process.wait()

async def main():
    """Main debug function"""
    print("🔍 MCP Server Debug Suite")
    print("=" * 50)
    
    client = MCPDebugClient()
    
    try:
        # Step 1: Start server
        if not await client.start_server():
            print("❌ Failed to start server")
            return
        
        # Check for immediate stderr
        await asyncio.sleep(1)
        await client.check_server_stderr()
        
        # Step 2: Test initialization
        if not await client.test_initialize():
            print("❌ Initialization failed")
            await client.check_server_stderr()
            return
        
        # Step 3: Test tools list
        if not await client.test_tools_list():
            print("❌ Tools list failed")
            await client.check_server_stderr()
            return
        
        # Step 4: Test ping tool
        if not await client.test_ping_tool():
            print("❌ Ping tool failed")
            await client.check_server_stderr()
            return
        
        print("\n🎉 All tests passed!")
        
    except KeyboardInterrupt:
        print("\n⏹️ Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        logger.exception("Unexpected error in main")
    finally:
        await client.check_server_stderr()
        await client.stop_server()

if __name__ == "__main__":
    asyncio.run(main())