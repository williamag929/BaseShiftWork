# ShiftWork Wiki Content Guide

This document serves as a complete guide for populating the GitHub Wiki. It provides an organized structure of all documentation in the repository and recommended wiki pages.

## Wiki Structure Overview

The wiki should be organized into the following main sections:

1. **Home** - Landing page with quick links and overview
2. **Getting Started** - Quick start guides and setup instructions
3. **Architecture** - Technical architecture and design
4. **Development** - Development guides for each component
5. **API Reference** - API endpoints and usage
6. **Features** - Feature documentation and guides
7. **Contributing** - Contribution guidelines
8. **MCP Integration** - Model Context Protocol guides

---

## Recommended Wiki Pages

### 1. Home (Wiki Landing Page)

**Source:** README.md  
**Purpose:** Main landing page for the wiki

**Content Structure:**
```markdown
# Welcome to the ShiftWork Wiki

ShiftWork is a full-stack workforce management application for time tracking and employee scheduling.

## Quick Links
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture)
- [API Reference](#api-reference)
- [Contributing](#contributing)

## Project Components
- **Backend API:** ASP.NET Core (.NET 8)
- **Web Frontend:** Angular with TypeScript
- **Mobile App:** React Native with Expo
- **MCP Server:** Python-based agent utilities

## Documentation Quick Access
- 📚 [Quick Start Guide](Quick-Start)
- 🏗️ [Architecture Guide](Architecture)
- 🔧 [API Documentation](API-Reference)
- 📱 [Mobile Development](Mobile-Development)
- 🌐 [Web Development](Web-Development)
- 🤖 [Agent & MCP Guide](Agent-Guide)
```

---

### 2. Quick Start

**Source:** QUICK_START.md  
**Purpose:** Get started in 5 minutes

**Key Sections:**
- GitHub MCP setup
- Basic issue creation
- Common workflows
- Tool reference
- Essential reading links

---

### 3. Architecture Overview

**Source:** README.md (sections 1-2), AGENT.md (Overview & Architecture sections)

**Content:**
```markdown
# Architecture Overview

## System Components

### Backend API (ShiftWork.Api)
- ASP.NET Core Web API
- Entity Framework Core with SQL Server
- Firebase JWT authentication
- AWS S3 for photo storage

### Web Frontend (ShiftWork.Angular)
- Angular framework
- Kiosk and dashboard features
- PWA capabilities
- Wake Lock API for kiosk mode

### Mobile App (ShiftWork.Mobile)
- React Native with Expo SDK 50
- File-based routing (Expo Router)
- Zustand state management
- Push notifications

### MCP Server (python_client)
- HTTP MCP server
- Agent-callable tools
- Health checks and schedule retrieval

## Data Model
- Company & CompanyUser
- Person (employees)
- Role, Area, Location
- Schedule & ScheduleShift
- TaskShift
- ShiftEvent (clock events)
- KioskQuestion & KioskAnswer
- TimeOffRequest & PTOLedger
```

---

### 4. API Reference

**Source:** AGENT.md (Key API Endpoints section)

**Content:**
```markdown
# API Reference

## Authentication Endpoints
- GET /api/auth/user/{email}
- POST /api/auth/verify-pin

## Schedule Endpoints
- GET /api/companies/{companyId}/schedules
- POST /api/companies/{companyId}/schedules
- PUT /api/companies/{companyId}/schedules/{scheduleId}
- DELETE /api/companies/{companyId}/schedules/{scheduleId}
- GET /api/companies/{companyId}/schedules/search

## Shift Event Endpoints (Clock Actions)
- GET /api/companies/{companyId}/shiftevents
- POST /api/companies/{companyId}/shiftevents
- GET /api/companies/{companyId}/shiftevents/person/{personId}

## Time-Off Endpoints
- GET /api/companies/{companyId}/timeoff-requests
- POST /api/companies/{companyId}/timeoff-requests
- PATCH /api/companies/{companyId}/timeoff-requests/{requestId}/approve

## PTO Balance Endpoints
- GET /api/companies/{companyId}/pto/balance/{personId}
- PUT /api/companies/{companyId}/pto/config/{personId}

## Kiosk Endpoints
- GET /api/kiosk/{companyId}/questions
- POST /api/kiosk/answers

## Webhook Endpoints (Automatic)
- Automatic webhooks on employee.created, employee.updated
- Automatic webhooks on location.created, location.updated
```

---

### 5. Backend Development Guide

**Source:** AGENT.md (Local Development section), README.md (Backend section)

**Content:**
```markdown
# Backend Development Guide

## Prerequisites
- .NET 8 SDK
- SQL Server or PostgreSQL
- AWS account (for S3)
- Firebase project

## Environment Setup

Required environment variables:
- DB_CONNECTION_STRING
- FIREBASE_PROJECT_ID
- FIREBASE_AUTH_DOMAIN
- FIREBASE_API_KEY
- WEBHOOK_URL (optional)
- WEBHOOK_SECRET_KEY (optional)

## Running the API

PowerShell:
```powershell
cd ShiftWork.Api
$env:DB_CONNECTION_STRING = "Server=localhost;Database=ShiftWork;..."
$env:FIREBASE_PROJECT_ID = "your-project"
$env:FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"
$env:FIREBASE_API_KEY = "your-firebase-web-api-key"
dotnet restore
dotnet build
dotnet run
```

## Project Structure
- Controllers/ - API controllers
- Services/ - Business logic
- Models/ - Domain entities
- DTOs/ - Data transfer objects
- Data/ - DbContext and EF Core
- Migrations/ - Database migrations
- Helpers/ - AutoMapper profiles

## Testing
- Use ShiftWork.Api/ShiftWork.Api.http for REST testing
- Swagger UI available at /swagger endpoint
```

---

### 6. Web Frontend Development Guide

**Source:** ShiftWork.Angular/README.md, AGENT.md

**Content:**
```markdown
# Web Frontend Development Guide

## Prerequisites
- Node.js 18+
- npm

## Environment Setup

Required environment variables:
- API_URL
- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID

## Running the Angular App

PowerShell:
```powershell
cd ShiftWork.Angular
$env:API_URL = "https://localhost:5001"
$env:FIREBASE_API_KEY = "your-firebase-web-api-key"
# ... other Firebase env vars
npm install
npm run start
```

## HTTPS for Development

For camera and Wake Lock features:
```powershell
ng serve --ssl true --ssl-key ".\ssl\localhost.key" --ssl-cert ".\ssl\localhost.crt"
```

## Project Structure
- src/app/core/ - Core services, guards, interceptors
- src/app/features/ - Feature modules
- src/app/shared/ - Shared components
- src/app/store/ - State management (NgRx)

## Key Features
- Kiosk mode with Wake Lock
- PWA support
- Camera integration
- Location tracking
```

---

### 7. Mobile Development Guide

**Source:** ShiftWork.Mobile/README.md, MOBILE_FEATURES_SUMMARY.md, MOBILE_AGENT.md

**Content:**
```markdown
# Mobile Development Guide

## Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) or Android Studio

## Environment Setup

Copy .env.example to .env and configure:
- EXPO_PUBLIC_API_URL
- EXPO_PUBLIC_FIREBASE_* variables
- EXPO_PUBLIC_AWS_* variables

## Running the Mobile App

PowerShell:
```powershell
cd ShiftWork.Mobile
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env with your configuration
npm start
```

Run on specific platform:
- iOS: npm run ios
- Android: npm run android

## Project Structure
- app/ - Expo Router pages
- services/ - API and business logic
- components/ - Reusable UI components
- stores/ - Zustand state management
- utils/ - Helper functions

## Completed Features
- Clock In/Out with photo capture
- Weekly schedule view
- Dashboard with stats
- Time off requests
- Push notifications
- Biometric authentication
- Profile management
```

---

### 8. Agent & MCP Guide

**Source:** AGENT.md, GITHUB_MCP_GUIDE.md, python_client/MCP_SERVER.md

**Content:**
```markdown
# Agent & MCP Integration Guide

## Overview

ShiftWork provides comprehensive agent support through:
- Detailed agent documentation
- Python MCP server
- GitHub MCP integration
- Agent task recipes

## MCP Server Setup

From python_client directory:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python http_mcp_server.py --mode http --port 8080
```

## Available MCP Tools
- GET /health - Health check
- GET /ping - Ping endpoint
- GET /api/tools - List available tools
- POST /api/tools/execute - Execute a tool
- GET /api/employees/{company_id}/{person_id}/schedules

## Agent Task Recipes

### Clock In
POST /api/companies/{companyId}/shiftevents
```json
{
  "eventDate": "2025-11-05T14:30:00Z",
  "eventType": "clock_in",
  "companyId": "acme-123",
  "personId": 42,
  "geoLocation": "40.741895,-73.989308",
  "photoUrl": "https://s3.amazonaws.com/..."
}
```

### Find Upcoming Shifts
GET /api/companies/{companyId}/schedules/search?personId={id}&startDate={ISO}&endDate={ISO}

### Verify PIN
POST /api/auth/verify-pin
```json
{
  "personId": 42,
  "pin": "1234"
}
```
```

---

### 9. Features Guide

**Source:** AGENT.md (Recent Features section), WEBHOOK_INTEGRATION.md, PUSH_NOTIFICATIONS.md

**Content:**
```markdown
# Features Guide

## Time-Off Management (MVP Complete)
- TimeOffRequest model with approval workflow
- Full CRUD API endpoints
- Overlap validation
- Auto-creates ShiftEvent on approval
- Manager approval dashboard
- PTO balance integration

## PTO Balance Tracking (MVP Complete)
- PTOLedger model tracking accruals and usage
- Monthly accrual system
- Per-person configuration
- Automatic deduction on approval
- Balance queries and configuration endpoints

## Notification Service (Complete)
- Multi-channel support: Email (SMTP), SMS (Twilio), Push
- Configurable per notification
- Integrated into replacement requests
- Time-off decision notifications
- Graceful fallback when providers not configured

## Webhook Integration (Complete)
- Automatic webhooks on employee/location changes
- HMAC SHA256 signature verification
- Retry logic with exponential backoff
- Integration with Zapier, n8n, Make

## Kiosk Features
- PIN verification (BCrypt-based)
- Photo capture on clock events
- Geolocation tracking
- Custom questions at clock-out
- Unique kiosk identifiers
- Wake Lock API support

## Mobile Features
- Personal clock in/out
- Photo capture and GPS tracking
- Weekly schedule view
- Push notifications
- Biometric authentication
- Time off requests
- Profile management
```

---

### 10. Contributing Guide

**Source:** CONTRIBUTING.md

**Content:**
```markdown
# Contributing to ShiftWork

## Code of Conduct
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Gracefully accept constructive criticism
- Focus on what is best for the community

## Getting Started

### Prerequisites
- Git installed and configured
- GitHub account
- Development environment for your area

### Setup Steps
1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Write/update tests
6. Submit a pull request

## Development Workflow
1. Check existing issues
2. Create an issue if needed
3. Assign yourself
4. Create feature branch
5. Make changes
6. Test thoroughly
7. Submit PR

## Coding Standards

### Backend (.NET)
- Follow C# naming conventions
- Use async/await pattern
- Write XML documentation
- Use dependency injection

### Frontend (Angular)
- Follow Angular style guide
- Use TypeScript strict mode
- Component-based architecture
- Write unit tests

### Mobile (React Native)
- Follow React Native best practices
- Use TypeScript
- Functional components with hooks
- Write component tests

## Pull Request Process
1. Update documentation
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG if applicable
5. Request review
6. Address feedback
7. Wait for approval

## Issue Guidelines
- Use issue templates
- Be specific and descriptive
- Include reproduction steps
- Add appropriate labels
- Link related issues
```

---

### 11. GitHub Issues Guide

**Source:** GITHUB_ISSUES_GUIDE.md

---

### 12. GitHub MCP Guide

**Source:** GITHUB_MCP_GUIDE.md

---

### 13. Security & Authentication

**Source:** AGENT.md (Security & Auth Notes section)

**Content:**
```markdown
# Security & Authentication

## Firebase JWT Validation
- Uses Google's public keys
- Authority: https://securetoken.google.com/{projectId}
- Issuer and audience checks
- No symmetric signing key needed

## CORS Configuration
- Configured for localhost and production domains
- Allows credentials
- Specific origin validation

## Kiosk Security
- All kiosk endpoints require [Authorize]
- Bearer token authentication
- PIN verification with BCrypt hashing

## Best Practices
- Never commit secrets
- Use environment variables
- Rotate tokens regularly
- Implement rate limiting
- Log security events
```

---

### 14. Company Settings

**Source:** AGENT.md (Company Settings section)

**Content:**
```markdown
# Company Settings Configuration

## Overview
Company Settings UI provides 8 tabs covering all configuration options.

## Pending Backend Implementation (22 items)

### Clock-In/Out Enforcement (5 items)
- Geo-fence validation
- Auto clock-out scheduler
- Grace period for late arrivals
- Early clock-in rules
- Break clock enforcement

### Pay & Overtime (1 item)
- Overtime multipliers (night/holiday/weekend)

### PTO & Leave Automation (3 items)
- PTO accrual scheduler
- Sick leave accrual scheduler
- Annual PTO rollover logic

### Scheduling Workflows (2 items)
- Auto-approve shifts setting
- Shift swap approval workflow

### Notification Automation (2 items)
- Notification triggers implementation
- Shift reminder scheduler

### Kiosk Features (2 items)
- Photo on clock-in requirement
- Custom questions on clock-in

### Security Enforcement (2 items)
- Password expiration enforcement
- Session timeout middleware

## Already Implemented
- ✅ Maximum consecutive work days
- ✅ Minimum hours between shifts
- ✅ Daily/weekly hour limits
- ✅ Overlapping shifts prevention
```

---

## Documentation File Mapping

| Wiki Page | Source File(s) | Status |
|-----------|---------------|--------|
| Home | README.md | ✅ Exists |
| Quick Start | QUICK_START.md | ✅ Exists |
| Architecture | README.md, AGENT.md | ✅ Exists |
| API Reference | AGENT.md | ✅ Exists |
| Backend Development | AGENT.md, README.md | ✅ Exists |
| Web Development | ShiftWork.Angular/README.md, AGENT.md | ✅ Exists |
| Mobile Development | ShiftWork.Mobile/README.md, MOBILE_AGENT.md | ✅ Exists |
| Agent & MCP Guide | AGENT.md, GITHUB_MCP_GUIDE.md | ✅ Exists |
| Features Guide | AGENT.md, WEBHOOK_INTEGRATION.md, PUSH_NOTIFICATIONS.md | ✅ Exists |
| Contributing | CONTRIBUTING.md | ✅ Exists |
| GitHub Issues | GITHUB_ISSUES_GUIDE.md | ✅ Exists |
| GitHub MCP | GITHUB_MCP_GUIDE.md | ✅ Exists |
| Security | AGENT.md | ✅ Exists |
| Company Settings | AGENT.md | ✅ Exists |

---

## Additional Resources

### Supplementary Documentation
- **BIOMETRIC_AUTH.md** - Biometric authentication implementation (Mobile)
- **WEBHOOK_INTEGRATION.md** - Webhook setup and usage
- **PUSH_NOTIFICATIONS.md** - Push notification configuration
- **MCP_FUTURE_FEATURES.md** - Planned MCP features
- **MOBILE_FEATURES_SUMMARY.md** - Mobile feature completion summary
- **MCP_SERVER.md** - Python MCP server architecture

### Component-Specific
- **ShiftWork.Mobile/MOBILE_AGENT.md** - Mobile-specific agent guide
- **ShiftWork.Mobile/SETUP.md** - Mobile setup instructions
- **ShiftWork.Mobile/FEATURES_COMPLETE.md** - Completed mobile features

---

## Wiki Update Instructions

### Manual Wiki Population Steps

1. **Access the Wiki**
   - Navigate to: https://github.com/williamag929/BaseShiftWork/wiki
   - Click "Create the first page" or edit existing pages

2. **Create Home Page**
   - Use content from "Home (Wiki Landing Page)" section above
   - Source: README.md

3. **Create Each Recommended Page**
   - Follow the structure in "Recommended Wiki Pages" section
   - Copy and adapt content from source files listed
   - Maintain internal wiki links using format: `[Link Text](Page-Name)`

4. **Create Sidebar Navigation**
   - Create a page named `_Sidebar`
   - Add navigation links to all wiki pages
   - Group by category (Getting Started, Development, Features, etc.)

5. **Create Footer** (Optional)
   - Create a page named `_Footer`
   - Add copyright, version, and last updated information

### Sidebar Structure Example

```markdown
**Getting Started**
- [Home](Home)
- [Quick Start](Quick-Start)
- [Architecture](Architecture)

**Development**
- [Backend Development](Backend-Development)
- [Web Development](Web-Development)
- [Mobile Development](Mobile-Development)

**API & Features**
- [API Reference](API-Reference)
- [Features Guide](Features-Guide)

**Agent & Integration**
- [Agent & MCP Guide](Agent-MCP-Guide)
- [GitHub Issues](GitHub-Issues)
- [GitHub MCP](GitHub-MCP)

**Contributing**
- [Contributing Guide](Contributing)
- [Security](Security)
```

---

## Maintenance Notes

### Keeping Wiki in Sync

When documentation files are updated in the repository:

1. **Monitor Changes**
   - Watch for updates to any source files listed in "Documentation File Mapping"
   - Review PRs that modify documentation files

2. **Update Wiki**
   - Manually update corresponding wiki pages
   - Maintain link integrity
   - Update "Last Updated" timestamps

3. **Cross-Reference Validation**
   - Periodically verify all internal links work
   - Ensure external links (to repo files) are valid
   - Check that code examples are still current

### Wiki Automation (Future Enhancement)

Consider implementing:
- GitHub Action to sync wiki from documentation files
- Automated link validation
- Version tracking in wiki
- Change notifications

---

## Contact & Support

For questions about wiki content or structure:
- Create an issue with label `documentation`
- Reference this WIKI_CONTENT_GUIDE.md
- Tag with priority level if urgent

---

**Document Version:** 1.0  
**Last Updated:** February 17, 2026  
**Maintained By:** ShiftWork Team
