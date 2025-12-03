
GET  /health                                           - Health check
GET  /ping                                             - Ping test  
GET  /api/tools                                        - List tools
GET  /api/employees/{company_id}/{person_id}/schedules - Get schedules
POST /api/employees/schedules                          - Get schedules (JSON)
POST /api/tools/execute                                - Execute any tool



Run: 

python http_mcp_server.py --mode http --port 8080

 python http_smtp_client.py

Virtual enviroment

pip install virtualen
virtualenv venv
venv/Scripts/activate
pip install -r requirements.txt


# Simple health check
python ai_agent_test_interface.py health

# Get employee schedules
python ai_agent_test_interface.py schedules --company-id company123 --person-id employee456

# Mock email test
python ai_agent_test_interface.py mock-email --company-id company123 --person-id employee456 --email test@example.com

# Comprehensive test
python ai_agent_test_interface.py comprehensive



# Manual MCP Server Testing Guide

## Step 1: Start the Server
```bash
python3 paste.py
```

The server should start and wait for input. You'll see:
```
INFO:__main__:Starting ShiftWork MCP Server...
```

## Step 2: Send Initialize Request
Copy and paste this JSON (followed by two Enter presses):

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {...},
    "serverInfo": {
      "name": "shiftwork-server",
      "version": "1.0.0"
    }
  }
}
```

## Step 3: Send Tools List Request
```json
{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_employee_schedules",
        "description": "Get all schedules for a specific employee",
        "inputSchema": {...}
      },
      {
        "name": "ping",
        "description": "Test server connectivity",
        "inputSchema": {...}
      }
    ]
  }
}
```

## Step 4: Test Ping Tool
```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "ping", "arguments": {}}}
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "pong - server is running"
      }
    ]
  }
}
```

## Common Error Patterns

### 1. Invalid Request Parameters (-32602)
- **Cause**: Wrong parameter names or structure
- **Fix**: Check the MCP specification for correct parameter names

### 2. Method Not Found (-32601)
- **Cause**: The method name is incorrect
- **Fix**: Use exact method names: "initialize", "tools/list", "tools/call"

### 3. Server Not Responding
- **Cause**: Server crashed or input format wrong
- **Fix**: Check server logs, ensure JSON is properly formatted

## Debugging Tips

1. **Check Server Logs**: Look for error messages in the console
2. **Validate JSON**: Use a JSON validator to ensure requests are properly formatted
3. **Version Compatibility**: Ensure MCP client/server versions match
4. **Dependencies**: Verify all required packages are installed