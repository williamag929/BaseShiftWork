#!/usr/bin/env python3
"""
Simple debug test client for MCP server
"""

import asyncio
import json
import subprocess
import sys
import time

async def test_basic_communication():
    """Test basic communication with the MCP server"""
    
    print("🚀 Starting MCP server test...")
    
    # Start the server process
    print("📍 Starting server process...")
    process = await asyncio.create_subprocess_exec(
        sys.executable, "mcp_server.py",  # Use the debug server
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    try:
        # Give the server a moment to start
        await asyncio.sleep(0.5)
        
        print("📡 Sending initialize request...")
        
        # Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "debug-test", "version": "1.0.0"}
            }
        }
        
        # Send the request
        request_json = json.dumps(init_request) + "\n"
        process.stdin.write(request_json.encode())
        await process.stdin.drain()
        
        print("⏳ Waiting for response...")
        
        # Try to read response with timeout
        try:
            response_task = asyncio.create_task(process.stdout.readline())
            response_line = await asyncio.wait_for(response_task, timeout=10.0)
            
            if response_line:
                response_text = response_line.decode().strip()
                print(f"✅ Got response: {response_text}")
                
                try:
                    response_data = json.loads(response_text)
                    print("✅ Response is valid JSON")
                    
                    # Send initialized notification
                    initialized = {"jsonrpc": "2.0", "method": "initialized"}
                    process.stdin.write((json.dumps(initialized) + "\n").encode())
                    await process.stdin.drain()
                    print("✅ Sent initialized notification")
                    
                    # Test list tools
                    print("📋 Testing tools/list...")
                    list_tools = {
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "tools/list"
                    }
                    
                    process.stdin.write((json.dumps(list_tools) + "\n").encode())
                    await process.stdin.drain()
                    
                    tools_response = await asyncio.wait_for(process.stdout.readline(), timeout=5.0)
                    if tools_response:
                        print(f"🔧 Tools response: {tools_response.decode().strip()}")
                        
                        # Test a simple tool call
                        print("🧪 Testing tool call...")
                        test_call = {
                            "jsonrpc": "2.0",
                            "id": 3,
                            "method": "tools/call",
                            "params": {
                                "name": "test_connection",
                                "arguments": {}
                            }
                        }
                        
                        process.stdin.write((json.dumps(test_call) + "\n").encode())
                        await process.stdin.drain()
                        
                        call_response = await asyncio.wait_for(process.stdout.readline(), timeout=10.0)
                        if call_response:
                            print(f"🎯 Tool call response: {call_response.decode().strip()}")
                        else:
                            print("❌ No response to tool call")
                    
                except json.JSONDecodeError as e:
                    print(f"❌ Response is not valid JSON: {e}")
                    
            else:
                print("❌ No response received")
                
        except asyncio.TimeoutError:
            print("❌ Timeout waiting for response")
        
        # Check for any stderr output
        try:
            stderr_data = await asyncio.wait_for(process.stderr.read(1024), timeout=1.0)
            if stderr_data:
                print(f"🚨 Server stderr: {stderr_data.decode()}")
        except asyncio.TimeoutError:
            pass
            
    except Exception as e:
        print(f"❌ Test error: {e}")
    finally:
        print("🛑 Terminating server...")
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            print("⚠️ Force killing server...")
            process.kill()
            await process.wait()

if __name__ == "__main__":
    asyncio.run(test_basic_communication())
