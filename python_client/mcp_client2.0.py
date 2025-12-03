#!/usr/bin/env python3
"""
SMTP Client for ShiftWork MCP Server
Sends employee schedule information via email using SMTP
"""

import asyncio
import json
import logging
import smtplib
import ssl
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from email.mime.base import MimeBase
from email import encoders
from datetime import datetime
from typing import Dict, List, Optional
import subprocess
import sys
from dataclasses import dataclass

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

class MCPShiftWorkClient:
    """Client to interact with the ShiftWork MCP server"""
    
    def __init__(self, mcp_server_path: str = "./shiftwork_server.py"):
        self.mcp_server_path = mcp_server_path
        self.process = None
    
    async def start_mcp_server(self):
        """Start the MCP server process"""
        try:
            self.process = subprocess.Popen(
                [sys.executable, self.mcp_server_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            logger.info("MCP server started")
            return True
        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")
            return False
    
    async def send_mcp_request(self, method: str, params: dict) -> dict:
        """Send a JSON-RPC request to the MCP server"""
        if not self.process:
            raise RuntimeError("MCP server not started")
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }
        
        try:
            # Send request
            request_json = json.dumps(request) + '\n'
            self.process.stdin.write(request_json)
            self.process.stdin.flush()
            
            # Read response
            response_line = self.process.stdout.readline()
            if not response_line:
                raise RuntimeError("No response from MCP server")
            
            response = json.loads(response_line.strip())
            return response
        except Exception as e:
            logger.error(f"MCP request failed: {e}")
            raise
    
    async def get_employee_schedules(self, company_id: str, person_id: str) -> dict:
        """Get employee schedules via MCP server"""
        params = {
            "name": "get_employee_schedules",
            "arguments": {
                "company_id": company_id,
                "person_id": person_id
            }
        }
        
        response = await self.send_mcp_request("tools/call", params)
        
        if "error" in response:
            raise RuntimeError(f"MCP error: {response['error']}")
        
        # Parse the text response
        result_text = response.get("result", {}).get("content", [{}])[0].get("text", "{}")
        return json.loads(result_text)
    
    async def ping_server(self) -> str:
        """Ping the MCP server"""
        params = {
            "name": "ping",
            "arguments": {}
        }
        
        response = await self.send_mcp_request("tools/call", params)
        
        if "error" in response:
            raise RuntimeError(f"MCP error: {response['error']}")
        
        return response.get("result", {}).get("content", [{}])[0].get("text", "No response")
    
    async def stop_mcp_server(self):
        """Stop the MCP server process"""
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            logger.info("MCP server stopped")

class SMTPScheduleEmailer:
    """SMTP client for sending schedule emails"""
    
    def __init__(self, email_config: EmailConfig):
        self.config = email_config
        self.mcp_client = MCPShiftWorkClient()
    
    async def initialize(self):
        """Initialize the MCP client"""
        success = await self.mcp_client.start_mcp_server()
        if not success:
            raise RuntimeError("Failed to initialize MCP client")
        
        # Test connection
        try:
            ping_result = await self.mcp_client.ping_server()
            logger.info(f"MCP server ping: {ping_result}")
        except Exception as e:
            logger.warning(f"MCP server ping failed: {e}")
    
    def _create_schedule_email(self, email_data: ScheduleEmailData) -> MimeMultipart:
        """Create email message with schedule information"""
        msg = MimeMultipart()
        msg['From'] = self.config.sender_email
        msg['To'] = email_data.recipient_email
        msg['Subject'] = f"Work Schedule for {email_data.employee_name or email_data.person_id}"
        
        # Create email body
        if email_data.schedules:
            schedule_count = len(email_data.schedules)
            body = f"""
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
            body = f"""
Hello,

No schedules found for employee {email_data.employee_name or email_data.person_id} in company {email_data.company_id}.

This email was generated automatically on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.

Best regards,
ShiftWork Schedule System
"""
        
        msg.attach(MimeText(body, 'plain'))
        return msg
    
    async def send_schedule_email(self, email_data: ScheduleEmailData) -> bool:
        """Fetch schedules and send email"""
        try:
            # Get schedules from MCP server
            logger.info(f"Fetching schedules for employee {email_data.person_id} in company {email_data.company_id}")
            schedule_result = await self.mcp_client.get_employee_schedules(
                email_data.company_id, 
                email_data.person_id
            )
            
            # Update email data with fetched schedules
            email_data.schedules = schedule_result.get("schedules", [])
            
            # Create email
            message = self._create_schedule_email(email_data)
            
            # Send email via SMTP
            return self._send_smtp_email(message, email_data.recipient_email)
            
        except Exception as e:
            logger.error(f"Failed to send schedule email: {e}")
            return False
    
    def _send_smtp_email(self, message: MimeMultipart, recipient_email: str) -> bool:
        """Send email via SMTP"""
        try:
            # Create SMTP session
            if self.config.use_tls:
                context = ssl.create_default_context()
                server = smtplib.SMTP(self.config.smtp_server, self.config.smtp_port)
                server.starttls(context=context)
            else:
                server = smtplib.SMTP(self.config.smtp_server, self.config.smtp_port)
            
            # Login and send email
            server.login(self.config.sender_email, self.config.sender_password)
            text = message.as_string()
            server.sendmail(self.config.sender_email, recipient_email, text)
            server.quit()
            
            logger.info(f"Email sent successfully to {recipient_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            return False
    
    async def send_bulk_schedule_emails(self, email_requests: List[ScheduleEmailData]) -> Dict[str, bool]:
        """Send multiple schedule emails"""
        results = {}
        
        for email_data in email_requests:
            key = f"{email_data.person_id}@{email_data.company_id}"
            results[key] = await self.send_schedule_email(email_data)
            
            # Small delay between emails to avoid overwhelming SMTP server
            await asyncio.sleep(1)
        
        return results
    
    async def cleanup(self):
        """Cleanup resources"""
        await self.mcp_client.stop_mcp_server()

# Example usage and configuration
async def main():
    """Example usage of the SMTP client"""
    
    # Email configuration - UPDATE THESE VALUES
    email_config = EmailConfig(
        smtp_server="smtp.gmail.com",  # Gmail SMTP server
        smtp_port=587,  # TLS port
        sender_email="your-email@gmail.com",  # Your email
        sender_password="your-app-password",  # App password for Gmail
        use_tls=True
    )
    
    # Create SMTP client
    smtp_client = SMTPScheduleEmailer(email_config)
    
    try:
        # Initialize
        await smtp_client.initialize()
        
        # Example: Send single schedule email
        email_data = ScheduleEmailData(
            company_id="company123",
            person_id="employee456",
            recipient_email="manager@company.com",
            employee_name="John Doe"
        )
        
        success = await smtp_client.send_schedule_email(email_data)
        if success:
            print("Schedule email sent successfully!")
        else:
            print("Failed to send schedule email")
        
        # Example: Send bulk emails
        bulk_requests = [
            ScheduleEmailData(
                company_id="company123",
                person_id="emp001",
                recipient_email="emp001@company.com",
                employee_name="Alice Smith"
            ),
            ScheduleEmailData(
                company_id="company123",
                person_id="emp002",
                recipient_email="emp002@company.com",
                employee_name="Bob Johnson"
            )
        ]
        
        bulk_results = await smtp_client.send_bulk_schedule_emails(bulk_requests)
        print("Bulk email results:", bulk_results)
        
    except Exception as e:
        logger.error(f"Application error: {e}")
    finally:
        await smtp_client.cleanup()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Application interrupted")
    except Exception as e:
        print(f"Application failed: {e}")
        sys.exit(1)