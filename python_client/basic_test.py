#!/usr/bin/env python3
"""
Basic test that just verifies the server can start and respond
"""

import asyncio
import json
import subprocess
import sys

async def basic_test():
    print("🧪 Basic MCP Server Test")
    print("=" * 30)
    
    # Start the server
    print("🚀 Starting server...")
    process = await asyncio.create_subprocess_exec(
        sys.executable, "mcp_server.py",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    try:
        # Give server time to start
        await asyncio.sleep(1)
        
        print("📡 Sending initialize request...")
        
        # Send a simple initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "basic-test", "version": "1.0.0"}
            }
        }
        
        # Send request
        request_json = json.dumps(init_request) + "\n"
        process.stdin.write(request_json.encode())
        await process.stdin.drain()
        
        # Try to get response with timeout
        try:
            response_task = asyncio.create_task(process.stdout.readline())
            response_line = await asyncio.wait_for(response_task, timeout=10)
            
            if response_line:
                response_text = response_line.decode().strip()
                print(f"✅ Got response: {response_text[:100]}...")
                
                try:
                    response_data = json.loads(response_text)
                    if "result" in response_data:
                        print("✅ Server initialized successfully!")
                        server_info = response_data.get("result", {}).get("serverInfo", {})
                        if server_info:
                            print(f"   Server: {server_info.get('name', 'unknown')} v{server_info.get('version', 'unknown')}")
                        return True
                    elif "error" in response_data:
                        print(f"❌ Server error: {response_data['error']}")
                    else:
                        print(f"❓ Unexpected response format: {response_data}")
                        
                except json.JSONDecodeError as e:
                    print(f"❌ Invalid JSON response: {e}")
                    print(f"   Raw response: {response_text}")
                    
            else:
                print("❌ No response from server")
                
        except asyncio.TimeoutError:
            print("❌ Timeout waiting for response")
            
        # Check stderr for any startup messages
        try:
            stderr_task = asyncio.create_task(process.stderr.read(1024))
            stderr_data = await asyncio.wait_for(stderr_task, timeout=2)
            if stderr_data:
                stderr_text = stderr_data.decode()
                print(f"📋 Server stderr: {stderr_text}")
        except asyncio.TimeoutError:
            pass
            
        return False
        
    except Exception as e:
        print(f"❌ Test exception: {e}")
        return False
        
    finally:
        print("🛑 Cleaning up...")
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=3)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()

async def main():
    success = await basic_test()
    if success:
        print("\n🎉 Basic test passed! Your MCP server can start and respond.")
        print("Now you can try more advanced testing.")
    else:
        print("\n💥 Basic test failed. Check the error messages above.")
        return 1
    return 0

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(result)