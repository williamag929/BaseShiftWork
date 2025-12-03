# Enhanced tools section for your ShiftWork MCP server
# Add this to replace your current _setup_handlers method

def _setup_handlers(self):
    """Setup MCP handlers with enhanced tools"""
    @self.server.list_tools()
    async def list_tools() -> List[Tool]:
        logger.info("list_tools called")
        return [
            Tool(
                name="get_employee_schedules",
                description="Get all schedules for a specific employee with detailed information",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "company_id": {
                            "type": "string", 
                            "description": "The unique identifier for the company"
                        },
                        "person_id": {
                            "type": "string", 
                            "description": "The unique identifier for the employee"
                        }
                    },
                    "required": ["company_id", "person_id"]
                }
            ),
            Tool(
                name="get_company_schedules",
                description="Get all schedules for a specific company",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "company_id": {
                            "type": "string",
                            "description": "The unique identifier for the company"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of schedules to return (default: 100)",
                            "minimum": 1,
                            "maximum": 1000
                        }
                    },
                    "required": ["company_id"]
                }
            ),
            Tool(
                name="get_schedules_by_date",
                description="Get schedules for a specific date or date range",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "company_id": {
                            "type": "string",
                            "description": "The unique identifier for the company"
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date in YYYY-MM-DD format"
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date in YYYY-MM-DD format (optional)"
                        }
                    },
                    "required": ["company_id", "start_date"]
                }
            ),
            Tool(
                name="search_employees",
                description="Search for employees by name or ID pattern",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "company_id": {
                            "type": "string",
                            "description": "The unique identifier for the company"
                        },
                        "search_term": {
                            "type": "string",
                            "description": "Search term (name, ID, or partial match)"
                        }
                    },
                    "required": ["company_id", "search_term"]
                }
            ),
            Tool(
                name="get_schedule_summary",
                description="Get a summary of schedules with statistics",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "company_id": {
                            "type": "string",
                            "description": "The unique identifier for the company"
                        },
                        "person_id": {
                            "type": "string",
                            "description": "Optional: specific employee ID for individual summary"
                        }
                    },
                    "required": ["company_id"]
                }
            ),
            Tool(
                name="ping",
                description="Test server connectivity and API availability",
                inputSchema={"type": "object", "properties": {}, "required": []}
            ),
            Tool(
                name="get_server_status",
                description="Get detailed server status and API health information",
                inputSchema={"type": "object", "properties": {}, "required": []}
            )
        ]
    
    @self.server.call_tool()
    async def call_tool(name: str, arguments: dict) -> List[TextContent]:
        logger.info(f"Tool called: {name} with arguments: {arguments}")
        
        try:
            if name == "ping":
                return [TextContent(type="text", text="pong - ShiftWork MCP server is running")]
            
            elif name == "get_server_status":
                result = await self._get_server_status_impl()
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            elif name == "get_employee_schedules":
                result = await self._get_employee_schedules_impl(arguments)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            elif name == "get_company_schedules":
                result = await self._get_company_schedules_impl(arguments)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            elif name == "get_schedules_by_date":
                result = await self._get_schedules_by_date_impl(arguments)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            elif name == "search_employees":
                result = await self._search_employees_impl(arguments)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            elif name == "get_schedule_summary":
                result = await self._get_schedule_summary_impl(arguments)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            else:
                return [TextContent(type="text", text=f"Unknown tool: {name}")]
                
        except Exception as e:
            logger.error(f"Tool error: {e}", exc_info=True)
            return [TextContent(
                type="text", 
                text=f"Error: {str(e)}\n\nTroubleshooting:\n- Check that the ShiftWork API server is running on localhost:5182\n- Verify the company_id and person_id are correct\n- Check network connectivity"
            )]

# Additional implementation methods to add to your ShiftWorkServer class:

async def _get_server_status_impl(self) -> dict:
    """Get detailed server status"""
    try:
        client = await self._get_http_client()
        response = await client.get("/health", timeout=5.0)
        api_status = "online" if response.status_code == 200 else f"error_{response.status_code}"
    except Exception as e:
        api_status = f"offline - {str(e)}"
    
    return {
        "mcp_server": "running",
        "api_server": api_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

async def _get_company_schedules_impl(self, arguments: dict) -> dict:
    """Get all schedules for a company"""
    company_id = arguments.get("company_id")
    limit = arguments.get("limit", 100)
    
    if not company_id:
        raise ValueError("company_id is required")
    
    try:
        client = await self._get_http_client()
        response = await client.get(f"/api/companies/{company_id}/schedules")
        
        if response.status_code == 404:
            return {
                "company_id": company_id,
                "error": f"Company {company_id} not found",
                "total_schedules": 0,
                "schedules": []
            }
        
        response.raise_for_status()
        all_schedules = response.json()
        
        # Apply limit
        limited_schedules = all_schedules[:limit] if limit else all_schedules
        
        return {
            "company_id": company_id,
            "total_schedules": len(all_schedules),
            "returned_schedules": len(limited_schedules),
            "schedules": limited_schedules,
            "timestamp": datetime.now().isoformat()
        }
        
    except httpx.RequestError as e:
        raise RuntimeError(f"Network error: {str(e)}. Is the API server running on localhost:5182?")
    except Exception as e:
        raise RuntimeError(f"API error: {str(e)}")

async def _get_schedules_by_date_impl(self, arguments: dict) -> dict:
    """Get schedules by date range"""
    company_id = arguments.get("company_id")
    start_date = arguments.get("start_date")
    end_date = arguments.get("end_date")
    
    if not company_id or not start_date:
        raise ValueError("company_id and start_date are required")
    
    try:
        client = await self._get_http_client()
        response = await client.get(f"/api/companies/{company_id}/schedules")
        
        if response.status_code == 404:
            return {
                "company_id": company_id,
                "error": f"Company {company_id} not found",
                "schedules": []
            }
        
        response.raise_for_status()
        all_schedules = response.json()
        
        # Filter by date (this would need to be adapted based on your API's date format)
        filtered_schedules = []
        for schedule in all_schedules:
            # Assuming there's a date field - adjust based on your API structure
            schedule_date = schedule.get("date") or schedule.get("startDate")
            if schedule_date and start_date in str(schedule_date):
                if not end_date or end_date >= str(schedule_date):
                    filtered_schedules.append(schedule)
        
        return {
            "company_id": company_id,
            "start_date": start_date,
            "end_date": end_date,
            "total_schedules": len(filtered_schedules),
            "schedules": filtered_schedules,
            "timestamp": datetime.now().isoformat()
        }
        
    except httpx.RequestError as e:
        raise RuntimeError(f"Network error: {str(e)}. Is the API server running on localhost:5182?")
    except Exception as e:
        raise RuntimeError(f"API error: {str(e)}")

async def _search_employees_impl(self, arguments: dict) -> dict:
    """Search for employees"""
    company_id = arguments.get("company_id")
    search_term = arguments.get("search_term", "").lower()
    
    if not company_id or not search_term:
        raise ValueError("company_id and search_term are required")
    
    try:
        client = await self._get_http_client()
        response = await client.get(f"/api/companies/{company_id}/schedules")
        
        if response.status_code == 404:
            return {
                "company_id": company_id,
                "search_term": search_term,
                "error": f"Company {company_id} not found",
                "employees": []
            }
        
        response.raise_for_status()
        all_schedules = response.json()
        
        # Extract unique employees that match search term
        found_employees = {}
        for schedule in all_schedules:
            person_id = schedule.get("personId", "")
            person_name = schedule.get("personName", "")
            
            if (search_term in person_id.lower() or 
                search_term in person_name.lower()):
                
                if person_id not in found_employees:
                    found_employees[person_id] = {
                        "person_id": person_id,
                        "person_name": person_name,
                        "schedule_count": 0
                    }
                found_employees[person_id]["schedule_count"] += 1
        
        return {
            "company_id": company_id,
            "search_term": search_term,
            "total_employees_found": len(found_employees),
            "employees": list(found_employees.values()),
            "timestamp": datetime.now().isoformat()
        }
        
    except httpx.RequestError as e:
        raise RuntimeError(f"Network error: {str(e)}. Is the API server running on localhost:5182?")
    except Exception as e:
        raise RuntimeError(f"API error: {str(e)}")

async def _get_schedule_summary_impl(self, arguments: dict) -> dict:
    """Get schedule summary with statistics"""
    company_id = arguments.get("company_id")
    person_id = arguments.get("person_id")
    
    if not company_id:
        raise ValueError("company_id is required")
    
    try:
        client = await self._get_http_client()
        response = await client.get(f"/api/companies/{company_id}/schedules")
        
        if response.status_code == 404:
            return {
                "company_id": company_id,
                "error": f"Company {company_id} not found",
                "summary": {}
            }
        
        response.raise_for_status()
        all_schedules = response.json()
        
        # Filter for specific person if requested
        if person_id:
            all_schedules = [s for s in all_schedules if s.get("personId") == person_id]
        
        # Generate statistics
        total_schedules = len(all_schedules)
        unique_employees = len(set(s.get("personId", "") for s in all_schedules))
        
        summary = {
            "company_id": company_id,
            "person_id": person_id,
            "total_schedules": total_schedules,
            "unique_employees": unique_employees,
            "timestamp": datetime.now().isoformat()
        }
        
        if person_id:
            summary["employee_schedule_count"] = total_schedules
        
        return {"summary": summary}
        
    except httpx.RequestError as e:
        raise RuntimeError(f"Network error: {str(e)}. Is the API server running on localhost:5182?")
    except Exception as e:
        raise RuntimeError(f"API error: {str(e)}")