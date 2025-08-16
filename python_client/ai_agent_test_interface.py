#!/usr/bin/env python3
"""
AI Agent Test Interface for ShiftWork HTTP Client
Provides simple commands that an AI agent can use to test the system
"""

import asyncio
import json
import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
import argparse
import httpx

# Disable logging for cleaner AI agent interaction
logging.getLogger().setLevel(logging.ERROR)

class ShiftWorkTestInterface:
    """Test interface for AI agents to interact with ShiftWork system"""
    
    def __init__(self, server_url: str = "http://localhost:8080"):
        self.server_url = server_url.rstrip('/')
        self.client = None
    
    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check if the ShiftWork server is running"""
        try:
            response = await self.client.get(f"{self.server_url}/health")
            response.raise_for_status()
            return {
                "status": "success",
                "server_healthy": True,
                "data": response.json()
            }
        except Exception as e:
            return {
                "status": "error",
                "server_healthy": False,
                "error": str(e),
                "suggestion": "Make sure the server is running: python http_mcp_server.py --mode http --port 8080"
            }
    
    async def ping(self) -> Dict[str, Any]:
        """Test basic connectivity"""
        try:
            response = await self.client.get(f"{self.server_url}/ping")
            response.raise_for_status()
            return {
                "status": "success",
                "data": response.json()
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def list_tools(self) -> Dict[str, Any]:
        """List available tools"""
        try:
            response = await self.client.get(f"{self.server_url}/api/tools")
            response.raise_for_status()
            return {
                "status": "success",
                "data": response.json()
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def get_employee_schedules(self, company_id: str, person_id: str, method: str = "get") -> Dict[str, Any]:
        """
        Get employee schedules using different HTTP methods
        
        Args:
            company_id: Company identifier
            person_id: Employee identifier  
            method: "get", "post", or "tool" (default: "get")
        """
        try:
            if method.lower() == "get":
                url = f"{self.server_url}/api/employees/{company_id}/{person_id}/schedules"
                response = await self.client.get(url)
            
            elif method.lower() == "post":
                url = f"{self.server_url}/api/employees/schedules"
                payload = {"company_id": company_id, "person_id": person_id}
                response = await self.client.post(url, json=payload)
            
            elif method.lower() == "tool":
                url = f"{self.server_url}/api/tools/execute"
                payload = {
                    "tool_name": "get_employee_schedules",
                    "arguments": {"company_id": company_id, "person_id": person_id}
                }
                response = await self.client.post(url, json=payload)
            
            else:
                return {
                    "status": "error",
                    "error": f"Invalid method '{method}'. Use 'get', 'post', or 'tool'"
                }
            
            response.raise_for_status()
            result_data = response.json()
            
            # Extract actual schedule data based on method
            if method.lower() == "tool":
                schedules = result_data.get("result", {}).get("schedules", [])
                total = result_data.get("result", {}).get("total_schedules", 0)
            else:
                schedules = result_data.get("schedules", [])
                total = result_data.get("total_schedules", 0)
            
            return {
                "status": "success",
                "method_used": method,
                "company_id": company_id,
                "person_id": person_id,
                "total_schedules": total,
                "has_schedules": len(schedules) > 0,
                "schedules": schedules,
                "raw_response": result_data
            }
            
        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
                "company_id": company_id,
                "person_id": person_id,
                "method_used": method
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "company_id": company_id,
                "person_id": person_id,
                "method_used": method
            }
    
    async def test_all_methods(self, company_id: str, person_id: str) -> Dict[str, Any]:
        """Test all three methods of getting schedules"""
        results = {}
        
        for method in ["get", "post", "tool"]:
            result = await self.get_employee_schedules(company_id, person_id, method)
            results[f"{method}_method"] = result
        
        # Summary
        successful_methods = [k for k, v in results.items() if v.get("status") == "success"]
        
        return {
            "status": "success",
            "company_id": company_id,
            "person_id": person_id,
            "successful_methods": successful_methods,
            "total_successful": len(successful_methods),
            "results": results
        }
    
    async def mock_email_send(self, company_id: str, person_id: str, recipient_email: str, employee_name: str = None) -> Dict[str, Any]:
        """
        Mock email sending (gets schedules and formats email content without actually sending)
        """
        try:
            # Get schedules
            schedule_result = await self.get_employee_schedules(company_id, person_id)
            
            if schedule_result["status"] != "success":
                return {
                    "status": "error",
                    "error": "Failed to get schedules",
                    "details": schedule_result
                }
            
            # Create email content
            schedules = schedule_result.get("schedules", [])
            employee_display_name = employee_name or person_id
            
            if schedules:
                email_body = f"""Subject: Work Schedule for {employee_display_name}
From: system@shiftwork.com
To: {recipient_email}

Hello,

Here is the work schedule information for employee {employee_display_name}:

Company ID: {company_id}
Employee ID: {person_id}
Total Schedules: {len(schedules)}

Schedule Details:
"""
                for i, schedule in enumerate(schedules, 1):
                    email_body += f"\n--- Schedule {i} ---\n"
                    for key, value in schedule.items():
                        email_body += f"{key}: {value}\n"
                    email_body += "\n"
                
                email_body += f"""
This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
            else:
                email_body = f"""Subject: Work Schedule for {employee_display_name}
From: system@shiftwork.com
To: {recipient_email}

Hello,

No schedules found for employee {employee_display_name} in company {company_id}.

This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
            
            return {
                "status": "success",
                "action": "mock_email_send",
                "company_id": company_id,
                "person_id": person_id,
                "recipient_email": recipient_email,
                "employee_name": employee_display_name,
                "schedules_found": len(schedules),
                "email_content": email_body,
                "note": "This is a mock email - no actual email was sent"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run a comprehensive test of the entire system"""
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "tests": {}
        }
        
        # Test 1: Health Check
        test_results["tests"]["health_check"] = await self.health_check()
        
        # Test 2: Ping
        test_results["tests"]["ping"] = await self.ping()
        
        # Test 3: List Tools
        test_results["tests"]["list_tools"] = await self.list_tools()
        
        # Test 4: Test all schedule methods with sample data
        test_companies = [
            {"company_id": "6513451", "person_id": "6"},
            {"company_id": "6513451", "person_id": "6"},
            {"company_id": "6513451", "person_id": "7"}
        ]
        
        test_results["tests"]["schedule_retrieval"] = {}
        for test_case in test_companies:
            company_id = test_case["company_id"]
            person_id = test_case["person_id"]
            key = f"{company_id}_{person_id}"
            test_results["tests"]["schedule_retrieval"][key] = await self.test_all_methods(company_id, person_id)
        
        # Test 5: Mock email sending
        test_results["tests"]["mock_email"] = await self.mock_email_send(
            "6513451", "6", "williamag929@gmail.com", "John Doe"
        )
        
        # Summary
        all_tests = []
        def collect_test_statuses(obj, prefix=""):
            if isinstance(obj, dict):
                if "status" in obj:
                    all_tests.append(obj["status"] == "success")
                for key, value in obj.items():
                    if key != "status":
                        collect_test_statuses(value, f"{prefix}.{key}" if prefix else key)
        
        collect_test_statuses(test_results["tests"])
        
        test_results["summary"] = {
            "total_tests": len(all_tests),
            "passed": sum(all_tests),
            "failed": len(all_tests) - sum(all_tests),
            "success_rate": f"{(sum(all_tests) / len(all_tests) * 100):.1f}%" if all_tests else "0%"
        }
        
        return test_results

# Command-line interface for AI agents
async def main():
    parser = argparse.ArgumentParser(description='AI Agent Test Interface for ShiftWork')
    parser.add_argument('--server', default='http://localhost:8080', help='Server URL')
    parser.add_argument('command', choices=['health', 'ping', 'tools', 'schedules', 'test-all', 'mock-email', 'comprehensive'], 
                       help='Command to execute')
    
    # Arguments for specific commands
    parser.add_argument('--company-id', help='Company ID')
    parser.add_argument('--person-id', help='Person/Employee ID')
    parser.add_argument('--method', choices=['get', 'post', 'tool'], default='get', help='HTTP method to use')
    parser.add_argument('--email', help='Recipient email address')
    parser.add_argument('--employee-name', help='Employee display name')
    
    args = parser.parse_args()
    
    async with ShiftWorkTestInterface(args.server) as interface:
        
        if args.command == 'health':
            result = await interface.health_check()
            
        elif args.command == 'ping':
            result = await interface.ping()
            
        elif args.command == 'tools':
            result = await interface.list_tools()
            
        elif args.command == 'schedules':
            if not args.company_id or not args.person_id:
                result = {"status": "error", "error": "company-id and person-id are required"}
            else:
                result = await interface.get_employee_schedules(args.company_id, args.person_id, args.method)
                
        elif args.command == 'test-all':
            if not args.company_id or not args.person_id:
                result = {"status": "error", "error": "company-id and person-id are required"}
            else:
                result = await interface.test_all_methods(args.company_id, args.person_id)
                
        elif args.command == 'mock-email':
            if not all([args.company_id, args.person_id, args.email]):
                result = {"status": "error", "error": "company-id, person-id, and email are required"}
            else:
                result = await interface.mock_email_send(args.company_id, args.person_id, args.email, args.employee_name)
                
        elif args.command == 'comprehensive':
            result = await interface.run_comprehensive_test()
        
        # Output result as JSON for AI agent consumption
        print(json.dumps(result, indent=2))

# Simple function interface for AI agents
class AIAgentInterface:
    """Simple interface class that AI agents can use directly"""
    
    @staticmethod
    async def test_shiftwork_system(server_url: str = "http://localhost:8080"):
        """
        Simple test function that AI agents can call
        Returns comprehensive test results
        """
        async with ShiftWorkTestInterface(server_url) as interface:
            return await interface.run_comprehensive_test()
    
    @staticmethod
    async def get_employee_info(company_id: str, person_id: str, server_url: str = "http://localhost:8080"):
        """
        Get employee schedule information
        Returns formatted result for AI agent consumption
        """
        async with ShiftWorkTestInterface(server_url) as interface:
            return await interface.get_employee_schedules(company_id, person_id)
    
    @staticmethod
    async def simulate_email_workflow(company_id: str, person_id: str, recipient_email: str, 
                                    employee_name: str = None, server_url: str = "http://localhost:8080"):
        """
        Simulate the complete email workflow without actually sending emails
        Perfect for AI agent testing
        """
        async with ShiftWorkTestInterface(server_url) as interface:
            return await interface.mock_email_send(company_id, person_id, recipient_email, employee_name)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('{"status": "interrupted", "message": "Test interrupted by user"}')
    except Exception as e:
        print(f'{{"status": "error", "error": "{str(e)}"}}')
        sys.exit(1)