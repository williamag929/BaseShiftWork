#!/usr/bin/env python3
"""
Fixed HTTP SMTP Client for ShiftWork Server
Windows-compatible version with email import fixes
"""

import asyncio
import json
import logging
import smtplib
import ssl
import sys
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
import httpx

# Try different email import approaches for Windows compatibility
try:
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    EMAIL_IMPORTS_OK = True
except ImportError:
    try:
        # Alternative import method
        import email.mime.text as mime_text
        import email.mime.multipart as mime_multipart
        MimeText = mime_text.MIMEText
        MimeMultipart = mime_multipart.MIMEMultipart
        EMAIL_IMPORTS_OK = True
    except ImportError:
        EMAIL_IMPORTS_OK = False
        print("Warning: Email MIME imports failed. Email functionality will be limited.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class EmailConfig:
    """Email configuration settings"""
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_password: str
    use_tls: bool = True

@dataclass
class ScheduleEmailData:
    """Data structure for schedule email content"""
    company_id: str
    person_id: str
    recipient_email: str
    employee_name: Optional[str] = None
    schedules: Optional[List[Dict]] = None

class HTTPShiftWorkClient:
    """HTTP client to interact with the ShiftWork server"""
    
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url.rstrip('/')
        self.client = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.client = httpx.AsyncClient(timeout=30.0)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.client:
            await self.client.aclose()
    
    async def _ensure_client(self):
        """Ensure HTTP client is available"""
        if not self.client:
            self.client = httpx.AsyncClient(timeout=30.0)
    
    async def health_check(self) -> dict:
        """Check server health"""
        await self._ensure_client()
        try:
            response = await self.client.get(f"{self.base_url}/health")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            raise
    
    async def ping(self) -> dict:
        """Ping the server"""
        await self._ensure_client()
        try:
            response = await self.client.get(f"{self.base_url}/ping")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Ping failed: {e}")
            raise
    
    async def get_employee_schedules(self, company_id: str, person_id: str) -> dict:
        """Get employee schedules via HTTP GET"""
        await self._ensure_client()
        try:
            url = f"{self.base_url}/api/employees/{company_id}/{person_id}/schedules"
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {
                    "company_id": company_id,
                    "person_id": person_id,
                    "error": f"Company {company_id} not found",
                    "total_schedules": 0,
                    "schedules": []
                }
            raise
        except Exception as e:
            logger.error(f"Failed to get employee schedules: {e}")
            raise
    
    async def get_employee_schedules_post(self, company_id: str, person_id: str) -> dict:
        """Get employee schedules via HTTP POST"""
        await self._ensure_client()
        try:
            url = f"{self.base_url}/api/employees/schedules"
            payload = {
                "company_id": company_id,
                "person_id": person_id
            }
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get employee schedules (POST): {e}")
            raise
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> dict:
        """Execute any tool via HTTP POST"""
        await self._ensure_client()
        try:
            url = f"{self.base_url}/api/tools/execute"
            payload = {
                "tool_name": tool_name,
                "arguments": arguments
            }
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to execute tool {tool_name}: {e}")
            raise
    
    async def list_tools(self) -> dict:
        """List available tools"""
        await self._ensure_client()
        try:
            response = await self.client.get(f"{self.base_url}/api/tools")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            raise
    
    async def close(self):
        """Close the HTTP client"""
        if self.client:
            await self.client.aclose()
            self.client = None

class HTTPScheduleEmailer:
    """HTTP SMTP client for sending schedule emails"""
    
    def __init__(self, email_config: EmailConfig, server_url: str = "http://localhost:8080"):
        self.config = email_config
        self.http_client = HTTPShiftWorkClient(server_url)
        
        if not EMAIL_IMPORTS_OK:
            logger.warning("Email functionality disabled due to import issues")
    
    async def initialize(self) -> bool:
        """Initialize and test the HTTP client"""
        try:
            # Test server connection
            health = await self.http_client.health_check()
            logger.info(f"Server health: {health.get('status')}")
            
            # Test ping
            ping_result = await self.http_client.ping()
            logger.info(f"Server ping: {ping_result.get('message')}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to initialize HTTP client: {e}")
            return False
    
    def _create_simple_email_body(self, email_data: ScheduleEmailData) -> str:
        """Create plain text email body"""
        if email_data.schedules and len(email_data.schedules) > 0:
            schedule_count = len(email_data.schedules)
            body = f"""Subject: Work Schedule for {email_data.employee_name or email_data.person_id}
From: {self.config.sender_email}
To: {email_data.recipient_email}

Hello,

Here is the work schedule information for employee {email_data.employee_name or email_data.person_id}:

Company ID: {email_data.company_id}
Employee ID: {email_data.person_id}
Total Schedules: {schedule_count}

Schedule Details:
"""
            
            for i, schedule in enumerate(email_data.schedules, 1):
                body += f"\n--- Schedule {i} ---\n"
                for key, value in schedule.items():
                    body += f"{key}: {value}\n"
                body += "\n"
            
            body += f"""
This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
        else:
            error_msg = ""
            if hasattr(email_data, 'error') and email_data.error:
                error_msg = f"\n\nError: {email_data.error}"
            
            body = f"""Subject: Work Schedule for {email_data.employee_name or email_data.person_id}
From: {self.config.sender_email}
To: {email_data.recipient_email}

Hello,

No schedules found for employee {email_data.employee_name or email_data.person_id} in company {email_data.company_id}.{error_msg}

This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
        return body
    
    def _create_schedule_email(self, email_data: ScheduleEmailData):
        """Create email message with schedule information"""
        if not EMAIL_IMPORTS_OK:
            return self._create_simple_email_body(email_data)
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.config.sender_email
            msg['To'] = email_data.recipient_email
            msg['Subject'] = f"Work Schedule for {email_data.employee_name or email_data.person_id}"
            
            # Create email body
            if email_data.schedules and len(email_data.schedules) > 0:
                schedule_count = len(email_data.schedules)
                body = f"""Hello,

Here is the work schedule information for employee {email_data.employee_name or email_data.person_id}:

Company ID: {email_data.company_id}
Employee ID: {email_data.person_id}
Total Schedules: {schedule_count}

Schedule Details:
"""
                
                for i, schedule in enumerate(email_data.schedules, 1):
                    body += f"\n--- Schedule {i} ---\n"
                    for key, value in schedule.items():
                        body += f"{key}: {value}\n"
                    body += "\n"
                
                body += f"""
This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
            else:
                error_msg = ""
                if hasattr(email_data, 'error') and email_data.error:
                    error_msg = f"\n\nError: {email_data.error}"
                
                body = f"""Hello,

No schedules found for employee {email_data.employee_name or email_data.person_id} in company {email_data.company_id}.{error_msg}

This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
            
            msg.attach(MIMEText(body, 'plain'))
            return msg
            
        except Exception as e:
            logger.error(f"Failed to create MIME message: {e}")
            return self._create_simple_email_body(email_data)
    
    async def send_schedule_email(self, email_data: ScheduleEmailData, use_post: bool = False) -> bool:
        """Fetch schedules and send email"""
        try:
            # Get schedules from HTTP server
            logger.info(f"Fetching schedules for employee {email_data.person_id} in company {email_data.company_id}")
            
            if use_post:
                schedule_result = await self.http_client.get_employee_schedules_post(
                    email_data.company_id, 
                    email_data.person_id
                )
            else:
                schedule_result = await self.http_client.get_employee_schedules(
                    email_data.company_id, 
                    email_data.person_id
                )
            
            # Update email data with fetched schedules
            email_data.schedules = schedule_result.get("schedules", [])
            
            # Handle error case
            if "error" in schedule_result:
                email_data.error = schedule_result["error"]
                logger.warning(f"API returned error: {schedule_result['error']}")
            
            # Create and send email
            message = self._create_schedule_email(email_data)
            return self._send_smtp_email(message, email_data.recipient_email)
            
        except Exception as e:
            logger.error(f"Failed to send schedule email: {e}")
            return False
    
    def _send_smtp_email(self, message, recipient_email: str) -> bool:
        """Send email via SMTP - compatible with both MIME and simple text"""
        try:
            # Create SMTP session
            if self.config.use_tls:
                context = ssl.create_default_context()
                server = smtplib.SMTP(self.config.smtp_server, self.config.smtp_port)
                server.starttls(context=context)
            else:
                server = smtplib.SMTP(self.config.smtp_server, self.config.smtp_port)
            
            # Login
            server.login(self.config.sender_email, self.config.sender_password)
            
            # Send email - handle both MIME and simple text
            if EMAIL_IMPORTS_OK and hasattr(message, 'as_string'):
                text = message.as_string()
            else:
                text = str(message)
            
            server.sendmail(self.config.sender_email, recipient_email, text)
            server.quit()
            
            logger.info(f"Email sent successfully to {recipient_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            return False
    
    async def get_and_print_schedules(self, company_id: str, person_id: str):
        """Get and print schedules without sending email (for testing)"""
        try:
            schedule_result = await self.http_client.get_employee_schedules(company_id, person_id)
            print(f"\n=== Schedule Results for {person_id} in {company_id} ===")
            print(json.dumps(schedule_result, indent=2))
            return schedule_result
        except Exception as e:
            logger.error(f"Failed to get schedules: {e}")
            return None
    
    async def send_bulk_schedule_emails(self, email_requests: List[ScheduleEmailData]) -> Dict[str, bool]:
        """Send multiple schedule emails"""
        results = {}
        
        for email_data in email_requests:
            key = f"{email_data.person_id}@{email_data.company_id}"
            results[key] = await self.send_schedule_email(email_data)
            
            # Small delay between emails
            await asyncio.sleep(1)
        
        return results
    
    async def get_server_info(self) -> dict:
        """Get information about available tools and server status"""
        try:
            tools_info = await self.http_client.list_tools()
            health_info = await self.http_client.health_check()
            
            return {
                "server_health": health_info,
                "available_tools": tools_info,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get server info: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """Cleanup resources"""
        await self.http_client.close()

# Example usage with better error handling
async def main():
    """Example usage of the HTTP SMTP client"""
    
    print("=== ShiftWork HTTP SMTP Client ===")
    print(f"Email imports available: {EMAIL_IMPORTS_OK}")
    
    # Email configuration - UPDATE THESE VALUES
    email_config = EmailConfig(
        smtp_server="smtp.gmail.com",          # Gmail SMTP server
        smtp_port=587,                         # TLS port
        sender_email="williamag929@gmail.com",   # Your email
        sender_password="wppc zpla meii apol",   # App password for Gmail
        use_tls=True
    )
    
    # Create HTTP SMTP client
    smtp_client = HTTPScheduleEmailer(email_config, "http://localhost:8080")
    
    try:
        # Initialize and test connection
        print("\n1. Testing server connection...")
        if not await smtp_client.initialize():
            print("❌ Failed to connect to server")
            print("Make sure your HTTP server is running: python http_mcp_server.py --mode http --port 8080")
            return
        
        print("✅ Server connection successful")
        
        # Get server info
        print("\n2. Getting server information...")
        server_info = await smtp_client.get_server_info()
        print("Server Info:")
        print(json.dumps(server_info, indent=2))
        
        # Test getting schedules without sending email
        print("\n3. Testing schedule retrieval...")
        test_result = await smtp_client.get_and_print_schedules("6513451", "6")
        
        if test_result is None:
            print("❌ Failed to get schedules - check if your ShiftWork API is running on localhost:5182")
            return
        
        # Only try to send email if user has configured it
        if email_config.sender_email == "your-email@gmail.com":
            print("\n⚠️  Email configuration not updated. Skipping email sending.")
            print("To send emails, update the email_config in the main() function.")
        else:
            print("\n4. Sending test email...")
            # Example email
            email_data = ScheduleEmailData(
                company_id="6513451",
                person_id="6",
                recipient_email="williamag929@gmail.com",  # Change this to a real email
                employee_name="William A"
            )
            
            success = await smtp_client.send_schedule_email(email_data)
            if success:
                print("✅ Email sent successfully!")
            else:
                print("❌ Email sending failed - check your SMTP configuration")
        
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
    except Exception as e:
        logger.error(f"Application error: {e}")
        print(f"❌ Application error: {e}")
    finally:
        await smtp_client.cleanup()
        print("\n✅ Cleanup completed")

if __name__ == "__main__":
    try:
        # Check Python version
        if sys.version_info < (3, 7):
            print("❌ Python 3.7 or higher is required")
            sys.exit(1)
        
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nApplication interrupted")
    except Exception as e:
        print(f"Application failed: {e}")
        sys.exit(1)