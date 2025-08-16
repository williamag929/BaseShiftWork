
import requests
import json

def main():
    """
    A simple client to interact with the MCP server.
    """
    mcp_server_url = "http://localhost:8000"

    # 1. Discover available tools from the /mcp/context endpoint
    try:
        context_response = requests.get(f"{mcp_server_url}/mcp/context")
        context_response.raise_for_status()
        context = context_response.json()
        print("Available Tools:")
        print(json.dumps(context['tools'], indent=2))

    except requests.exceptions.RequestException as e:
        print(f"Error discovering tools: {e}")
        return

    # 2. Execute the 'get_schedules_for_employee' tool
    tool_name = "get_schedules_for_employee"
    company_id = "6513451"  # Replace with a valid company ID
    person_id = "6"    # Replace with a valid person ID

    action_payload = {
        "tool_name": tool_name,
        "parameters": {
            "company_id": company_id,
            "person_id": person_id,
        },
    }

    try:
        print(f"\nExecuting tool: {tool_name}...")
        action_response = requests.post(
            f"{mcp_server_url}/mcp/actions", json=action_payload
        )
        action_response.raise_for_status()
        result = action_response.json()
        print("\nTool Result:")
        print(json.dumps(result, indent=2))

    except requests.exceptions.RequestException as e:
        print(f"Error executing tool: {e}")

if __name__ == "__main__":
    main()
