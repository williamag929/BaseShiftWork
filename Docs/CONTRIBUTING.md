# Contributing to ShiftWork

Thank you for your interest in contributing to ShiftWork! This guide will help you get started with contributing to the project, whether you're fixing bugs, adding features, improving documentation, or helping with issues.

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Issue Guidelines](#issue-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)
9. [MCP Integration](#mcp-integration)
10. [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Git** installed and configured
- **GitHub account** with SSH or HTTPS authentication
- Development environment for your area of contribution:
  - **Backend (.NET):** .NET 8 SDK, SQL Server or PostgreSQL
  - **Frontend (Angular):** Node.js 18+, npm
  - **Mobile (React Native):** Node.js 18+, npm, Expo CLI
  - **MCP (Python):** Python 3.11+, pip

### First Time Setup

1. **Fork the repository**
   ```bash
   # Via GitHub web interface - click "Fork" button
   # Or via GitHub CLI
   gh repo fork williamag929/BaseShiftWork --clone
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/BaseShiftWork.git
   cd BaseShiftWork
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/williamag929/BaseShiftWork.git
   git fetch upstream
   ```

4. **Set up development environment**

   **Backend (API):**
   ```bash
   cd ShiftWork.Api
   dotnet restore
   dotnet build
   
   # Set environment variables
   export DB_CONNECTION_STRING="Server=localhost;Database=ShiftWork;..."
   export FIREBASE_PROJECT_ID="your-project"
   export FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
   export FIREBASE_API_KEY="your-api-key"
   
   # Run
   dotnet run
   ```

   **Frontend (Angular):**
   ```bash
   cd ShiftWork.Angular
   npm install
   
   # Set environment variables
   export API_URL="https://localhost:5001"
   export FIREBASE_API_KEY="your-api-key"
   export FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
   export FIREBASE_PROJECT_ID="your-project"
   export FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
   export FIREBASE_MESSAGING_SENDER_ID="000000000000"
   export FIREBASE_APP_ID="1:000000000000:web:xxxxx"
   
   # Run
   npm start
   ```

   **Mobile (React Native):**
   ```bash
   cd ShiftWork.Mobile
   npm install --legacy-peer-deps
   
   # Copy and configure environment
   cp .env.example .env
   # Edit .env with your values
   
   # Run
   npm start
   ```

   **MCP Server (Python):**
   ```bash
   cd python_client
   pip install -r requirements.txt
   
   # Set environment variable
   export API_BASE_URL="http://localhost:5182"
   
   # Run
   python http_mcp_server.py --mode http --port 8080
   ```

5. **Verify setup**
   ```bash
   # Backend
   curl http://localhost:5182/health
   
   # MCP
   curl http://localhost:8080/health
   
   # Frontend - visit http://localhost:4200
   # Mobile - scan QR code with Expo Go
   ```

---

## Development Workflow

### Branch Strategy

We use a feature branch workflow:

```
main (production)
  ├── develop (integration)
  │   ├── feature/add-biometric-auth
  │   ├── feature/improve-notification-service
  │   ├── bugfix/clock-in-null-reference
  │   └── docs/update-api-guide
```

### Creating a Feature Branch

1. **Sync with upstream**
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

2. **Create feature branch**
   ```bash
   # Branch naming convention:
   # feature/short-description
   # bugfix/short-description
   # docs/short-description
   # refactor/short-description
   
   git checkout -b feature/add-biometric-auth
   ```

3. **Make your changes**
   - Write clear, focused commits
   - Follow coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

4. **Commit changes**
   ```bash
   git add .
   git commit -m "Add biometric authentication to mobile app
   
   - Implement fingerprint support for Android
   - Implement Face ID support for iOS
   - Add fallback to PIN authentication
   - Update security documentation
   
   Closes #234"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/add-biometric-auth
   ```

6. **Create Pull Request**
   - Use the GitHub web interface or `gh pr create`
   - Fill out the PR template completely
   - Link related issues
   - Request reviewers

### Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

**Examples:**
```bash
feat(mobile): add biometric authentication

Implement fingerprint and Face ID support for quick login.
Falls back to PIN if biometric is not available.

Closes #234

---

fix(api): prevent null reference in clock-in

Add validation to ensure location is set before creating
shift event in KioskController.

Fixes #123

---

docs(readme): update MCP setup instructions

- Add Python 3.11+ requirement
- Include environment variable examples
- Fix broken links

---

refactor(services): use dependency injection for HttpClient

Replace manual HttpClient instantiation with DI pattern
for better testability and resource management.
```

### Keeping Your Branch Updated

```bash
# While working on a feature
git fetch upstream
git rebase upstream/main

# Or merge if you prefer
git merge upstream/main

# Push updates (may need force push after rebase)
git push origin feature/add-biometric-auth --force-with-lease
```

---

## Issue Guidelines

**Before creating an issue:**

1. **Search existing issues** - Someone may have already reported it
2. **Check discussions** - It might be better suited for a discussion
3. **Reproduce the bug** - Ensure you can consistently reproduce it
4. **Gather information** - Collect logs, screenshots, environment details

**When creating an issue:**

- Use the appropriate template (Bug Report, Feature Request, Documentation)
- Fill out all sections completely
- Use clear, descriptive titles
- Add appropriate labels
- Link related issues
- Be respectful and constructive

For detailed guidelines, see [GitHub Issues Guide](./GITHUB_ISSUES_GUIDE.md).

### Issue Labels We Use

| Label | Purpose |
|-------|---------|
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `documentation` | Documentation improvements |
| `good first issue` | Good for new contributors |
| `help wanted` | Extra attention needed |
| `mobile` | Mobile app (React Native) |
| `frontend` | Angular web app |
| `backend` | .NET API |
| `mcp` | Python MCP server |
| `priority: high` | High priority |
| `needs-triage` | Needs initial review |
| `wont-fix` | Will not be addressed |

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated (README, AGENT.md, etc.)
- [ ] Commits are well-formatted and descriptive
- [ ] Branch is up-to-date with main
- [ ] No merge conflicts

### PR Template

When creating a PR, fill out this template:

```markdown
## Description
Brief summary of the changes

## Related Issues
Closes #123
Relates to #456

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test coverage improvement

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing Done
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Tested on mobile (iOS/Android)
- [ ] Tested on web (Chrome/Firefox/Safari)

## Screenshots (if applicable)
Include before/after screenshots for UI changes

## Deployment Notes
Any special deployment steps or configuration changes needed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added and passing
- [ ] Changes are backward compatible (or marked as breaking)
```

### Review Process

1. **Automated Checks**
   - CI/CD pipeline runs automatically
   - All tests must pass
   - Code quality checks must pass
   - Security scans must pass

2. **Code Review**
   - At least one approval required
   - Address all feedback
   - Keep discussions focused and respectful

3. **Merge**
   - Squash and merge (default)
   - Delete branch after merge
   - Update related issues

### Responding to Feedback

- Be open to suggestions
- Ask questions if feedback is unclear
- Make requested changes in new commits
- Push updates to the same branch
- Re-request review after updates

---

## Coding Standards

### General Principles

1. **SOLID Principles** - Write maintainable, testable code
2. **DRY** - Don't Repeat Yourself
3. **KISS** - Keep It Simple, Stupid
4. **YAGNI** - You Aren't Gonna Need It
5. **Separation of Concerns** - Each module/class has one responsibility

### C# (.NET API)

**Naming Conventions:**
```csharp
// PascalCase for classes, methods, properties
public class ScheduleService : IScheduleService
{
    // PascalCase for public members
    public int ScheduleId { get; set; }
    
    // camelCase for parameters
    public void CreateSchedule(int personId, DateTime startDate)
    {
        // camelCase for local variables
        var scheduleDto = new ScheduleDto();
    }
    
    // _camelCase for private fields
    private readonly ILogger<ScheduleService> _logger;
}
```

**Code Style:**
```csharp
// Use async/await properly
public async Task<ScheduleDto> GetScheduleAsync(int id)
{
    return await _context.Schedules
        .Where(s => s.ScheduleId == id)
        .Select(s => _mapper.Map<ScheduleDto>(s))
        .FirstOrDefaultAsync();
}

// Use dependency injection
public class ScheduleController : ControllerBase
{
    private readonly IScheduleService _scheduleService;
    private readonly ILogger<ScheduleController> _logger;
    
    public ScheduleController(
        IScheduleService scheduleService,
        ILogger<ScheduleController> logger)
    {
        _scheduleService = scheduleService;
        _logger = logger;
    }
}

// Use proper error handling
try
{
    var result = await _scheduleService.CreateScheduleAsync(dto);
    return Ok(result);
}
catch (ValidationException ex)
{
    _logger.LogWarning(ex, "Validation failed for schedule creation");
    return BadRequest(ex.Message);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Error creating schedule");
    return StatusCode(500, "Internal server error");
}
```

### TypeScript (Angular & React Native)

**Naming Conventions:**
```typescript
// PascalCase for classes, interfaces, types
export class ScheduleService {
    // camelCase for methods and properties
    private apiUrl: string;
    
    getSchedules(): Observable<Schedule[]> {
        // ...
    }
}

// Interfaces with 'I' prefix (optional, but consistent)
export interface ISchedule {
    scheduleId: number;
    personId: number;
    startDate: Date;
}
```

**Code Style:**
```typescript
// Use async/await
async fetchSchedules(): Promise<Schedule[]> {
    try {
        const response = await this.http.get<Schedule[]>(
            `${this.apiUrl}/schedules`
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching schedules:', error);
        throw error;
    }
}

// Use strong typing
interface ClockInParams {
    personId: number;
    locationId: number;
    eventDate: Date;
    photoUrl?: string;
}

function clockIn(params: ClockInParams): Promise<ShiftEvent> {
    // ...
}

// Use arrow functions for callbacks
schedules.filter(s => s.status === 'Active')
    .map(s => ({ id: s.scheduleId, name: s.name }))
    .forEach(item => console.log(item));
```

### Python (MCP Server)

**Naming Conventions:**
```python
# snake_case for functions and variables
def get_employee_schedules(company_id: str, person_id: str):
    schedule_data = fetch_from_api(company_id, person_id)
    return schedule_data

# PascalCase for classes
class ShiftWorkServer:
    def __init__(self, http_port: int = 8080):
        self.http_port = http_port
```

**Code Style:**
```python
# Use type hints
async def get_schedule(schedule_id: int) -> Dict[str, Any]:
    client = await self._get_http_client()
    response = await client.get(f"/schedules/{schedule_id}")
    return response.json()

# Use docstrings
def process_shift_event(event_data: dict) -> ShiftEvent:
    """
    Process a shift event and create a ShiftEvent object.
    
    Args:
        event_data: Raw event data from API
        
    Returns:
        ShiftEvent object
        
    Raises:
        ValidationError: If event_data is invalid
    """
    # ...

# Use with statements for resources
async with self.http_client.stream("GET", url) as response:
    async for chunk in response.aiter_bytes():
        # Process chunk
```

### Documentation Comments

**C#:**
```csharp
/// <summary>
/// Creates a new schedule for an employee
/// </summary>
/// <param name="dto">Schedule data transfer object</param>
/// <returns>Created schedule with ID</returns>
/// <exception cref="ValidationException">Thrown when validation fails</exception>
public async Task<ScheduleDto> CreateScheduleAsync(ScheduleDto dto)
{
    // ...
}
```

**TypeScript:**
```typescript
/**
 * Fetches schedules for a specific person
 * @param personId The ID of the person
 * @param startDate Optional start date filter
 * @param endDate Optional end date filter
 * @returns Array of schedules
 */
async getSchedules(
    personId: number,
    startDate?: Date,
    endDate?: Date
): Promise<Schedule[]> {
    // ...
}
```

**Python:**
```python
async def execute_tool(self, name: str, arguments: dict) -> dict:
    """
    Execute an MCP tool by name
    
    Args:
        name: Tool name (e.g., "get_employee_schedules")
        arguments: Tool-specific arguments
        
    Returns:
        Dict containing tool result
        
    Raises:
        ValueError: If tool name is not recognized
        httpx.HTTPError: If API request fails
    """
    # ...
```

---

## Testing Requirements

### Unit Tests

**Required for:**
- All new services and controllers
- Bug fixes (regression tests)
- Complex business logic

**C# (xUnit):**
```csharp
public class ScheduleServiceTests
{
    [Fact]
    public async Task CreateSchedule_ValidData_ReturnsSchedule()
    {
        // Arrange
        var mockRepo = new Mock<IScheduleRepository>();
        var service = new ScheduleService(mockRepo.Object);
        var dto = new ScheduleDto { /* ... */ };
        
        // Act
        var result = await service.CreateScheduleAsync(dto);
        
        // Assert
        Assert.NotNull(result);
        Assert.Equal(dto.PersonId, result.PersonId);
        mockRepo.Verify(r => r.AddAsync(It.IsAny<Schedule>()), Times.Once);
    }
    
    [Theory]
    [InlineData(0)] // Invalid person ID
    [InlineData(-1)]
    public async Task CreateSchedule_InvalidPersonId_ThrowsException(int personId)
    {
        // Arrange & Act & Assert
        await Assert.ThrowsAsync<ValidationException>(
            () => service.CreateScheduleAsync(new ScheduleDto { PersonId = personId })
        );
    }
}
```

**TypeScript (Jest):**
```typescript
describe('ScheduleService', () => {
    let service: ScheduleService;
    let httpMock: HttpTestingController;
    
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [ScheduleService]
        });
        service = TestBed.inject(ScheduleService);
        httpMock = TestBed.inject(HttpTestingController);
    });
    
    it('should fetch schedules', async () => {
        const mockSchedules: Schedule[] = [/* ... */];
        
        const promise = service.getSchedules().toPromise();
        
        const req = httpMock.expectOne('/api/schedules');
        expect(req.request.method).toBe('GET');
        req.flush(mockSchedules);
        
        const result = await promise;
        expect(result).toEqual(mockSchedules);
    });
    
    afterEach(() => {
        httpMock.verify();
    });
});
```

### Integration Tests

Test complete workflows:
```csharp
[Collection("Integration")]
public class ClockInIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    
    public ClockInIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }
    
    [Fact]
    public async Task ClockIn_CompleteWorkflow_Success()
    {
        // 1. Create employee
        var person = await CreateTestPerson();
        
        // 2. Set location
        var location = await CreateTestLocation();
        
        // 3. Clock in
        var clockInResponse = await _client.PostAsJsonAsync(
            $"/api/companies/{CompanyId}/shiftevents",
            new ShiftEventDto
            {
                PersonId = person.Id,
                LocationId = location.Id,
                EventType = "clock_in",
                EventDate = DateTime.UtcNow
            }
        );
        
        // 4. Verify
        Assert.Equal(HttpStatusCode.Created, clockInResponse.StatusCode);
        var createdEvent = await clockInResponse.Content.ReadFromJsonAsync<ShiftEventDto>();
        Assert.NotNull(createdEvent.EventLogId);
    }
}
```

### Running Tests

```bash
# .NET API tests
cd ShiftWork.Api.Tests
dotnet test

# Angular tests
cd ShiftWork.Angular
npm test

# Mobile tests
cd ShiftWork.Mobile
npm test

# Python tests (if any)
cd python_client
pytest
```

---

## Documentation

### What to Document

1. **Code Changes**
   - Public API changes → Update API docs
   - New features → Update README, AGENT.md
   - Configuration changes → Update setup guides
   - Breaking changes → Migration guide

2. **New Features**
   - User-facing → Update user documentation
   - Developer-facing → Update technical docs
   - API changes → Update OpenAPI/Swagger

3. **Bug Fixes**
   - If bug was due to unclear docs → Improve documentation
   - Add troubleshooting section if helpful

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, quick start |
| `AGENT.md` | Complete technical guide for AI agents |
| `CONTRIBUTING.md` | This file - contribution guide |
| `GITHUB_MCP_GUIDE.md` | GitHub MCP integration guide |
| `GITHUB_ISSUES_GUIDE.md` | GitHub Issues best practices |
| `ShiftWork.Mobile/README.md` | Mobile app setup and development |
| `python_client/MCP_SERVER.md` | MCP server architecture |

### Documentation Standards

- Use Markdown for all documentation
- Include code examples
- Add screenshots for UI features
- Keep documentation up-to-date with code
- Link related documentation
- Use clear, concise language
- Include table of contents for long documents

---

## MCP Integration

When contributing MCP-related features, follow these guidelines:

### Adding New MCP Tools

1. **Define the tool schema** in `_setup_handlers()`
2. **Implement the logic** as `async def _tool_name_impl()`
3. **Add to dispatcher** in `call_tool()`
4. **Add HTTP endpoint** (optional, for mobile)
5. **Update documentation** in `MCP_SERVER.md`
6. **Add tests** for the new tool

### MCP Best Practices

- **Clear naming:** Use descriptive tool names
- **Type safety:** Use Pydantic for validation
- **Error handling:** Return user-friendly errors
- **Documentation:** Update tool descriptions
- **Testing:** Test both MCP and HTTP interfaces

See [GitHub MCP Guide](./GITHUB_MCP_GUIDE.md) for detailed MCP integration patterns.

---

## Community

### Getting Help

- **Discussions:** Ask questions in [GitHub Discussions](https://github.com/williamag929/BaseShiftWork/discussions)
- **Issues:** Report bugs or request features
- **Documentation:** Check existing docs first

### Staying Updated

- **Watch the repository:** Get notifications for updates
- **Follow releases:** Subscribe to release notifications
- **Join discussions:** Participate in feature planning

### Recognition

Contributors are recognized in:
- Release notes for their contributions
- README.md (contributors section)
- GitHub insights and contributor graph

---

## Questions?

If you have questions not covered here:
1. Check the [GitHub Issues Guide](./GITHUB_ISSUES_GUIDE.md)
2. Check the [GitHub MCP Guide](./GITHUB_MCP_GUIDE.md)
3. Search [existing issues](https://github.com/williamag929/BaseShiftWork/issues)
4. Ask in [Discussions](https://github.com/williamag929/BaseShiftWork/discussions)
5. Create a new issue with the "question" label

---

**Thank you for contributing to ShiftWork!** 🎉

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Maintained By:** ShiftWork Development Team
