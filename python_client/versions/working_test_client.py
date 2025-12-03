#!/usr/bin/env python3
"""
Working test client for the MCP server
"""

import asyncio
import json
import subprocess
import sys

async def test_mcp_server():
    print("🚀 Starting MCP Server Test")
    print("=" * 50)
    
    # Start the server
    process = await asyncio.create_subprocess_exec(
        sys.executable, "compatible_mcp_server.py",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    async def send_request(request):
        """Send a request and get response"""
        request_json = json.dumps(request) + "\n"
        process.stdin.write(request_json.encode())
        await process.stdin.drain()
        
        response_line = await asyncio.wait_for(process.stdout.readline(), timeout=10)
        return json.loads(response_line.decode().strip())
    
    try:
        # 1. Initialize
        print("📡 1. Initializing...")
        init_response = await send_request({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "test-client", "version": "1.0.0"}
            }
        })
        print(f"   ✅ Init response: {init_response.get('result', {}).get('serverInfo', {})}")
        
        # 2. Send initialized notification
        print("📋 2. Sending initialized notification...")
        await send_request({"jsonrpc": "2.0", "method": "initialized"})
        # No response expected for notifications
        
        # 3. List tools
        print("🔧 3. Listing tools...")
        tools_response = await send_request({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list"
        })
        
        if "result" in tools_response and "tools" in tools_response["result"]:
            tools = tools_response["result"]["tools"]
            print(f"   ✅ Found {len(tools)} tools:")
            for tool in tools:
                print(f"      • {tool['name']}: {tool['description']}")
        else:
            print(f"   ❌ Unexpected tools response: {tools_response}")
        
        # 4. Test ping
        print("🏓 4. Testing ping tool...")
        ping_response = await send_request({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "ping",
                "arguments": {}
            }
        })
        
        if "result" in ping_response:
            content = ping_response["result"]["content"]
            if content and len(content) > 0:
                print(f"   ✅ Ping result: {content[0].get('text', 'No text')}")
            else:
                print("   ❌ No content in ping response")
        else:
            print(f"   ❌ Ping error: {ping_response.get('error', 'Unknown error')}")
        
        # 5. Test employee schedules (this will likely fail if API isn't running)
        print("📅 5. Testing get_employee_schedules...")
        schedule_response = await send_request({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "get_employee_schedules",
                "arguments": {
                    "company_id": "6513451",
                    "person_id": "6"
                }
            }
        })
        
        if "result" in schedule_response:
            content = schedule_response["result"]["content"]
            if content and len(content) > 0:
                text = content[0].get('text', '')
                print(f"   ✅ Schedule result preview: {text[:200]}...")
            else:
                print("   ❌ No content in schedule response")
        else:
            error = schedule_response.get('error', {})
            print(f"   ⚠️ Schedule error (expected if API not running): {error.get('message', 'Unknown')}")
        
        print("\n🎉 Test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        
        # Try to read any stderr
        try:
            stderr_data = await asyncio.wait_for(process.stderr.read(), timeout=1)
            if stderr_data:
                print(f"Server stderr: {stderr_data.decode()}")
        except:
            pass
            
    finally:
        print("🛑 Stopping server...")
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()

if __name__ == "__main__":
    asyncio.run(test_mcp_server())