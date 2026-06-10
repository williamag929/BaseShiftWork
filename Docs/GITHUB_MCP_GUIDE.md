# GitHub MCP (Model Context Protocol) Integration Guide

## Table of Contents
1. [What is GitHub MCP](#what-is-github-mcp)
2. [Why Use GitHub MCP](#why-use-github-mcp)
3. [Prerequisites](#prerequisites)
4. [Setup and Configuration](#setup-and-configuration)
5. [MCP Tools Available](#mcp-tools-available)
6. [Best Practices](#best-practices)
7. [Common Workflows](#common-workflows)
8. [Integration with ShiftWork](#integration-with-shiftwork)
9. [Troubleshooting](#troubleshooting)
10. [Additional Resources](#additional-resources)

---

## What is GitHub MCP

The Model Context Protocol (MCP) is an open protocol that standardizes how AI applications interact with external data sources and tools. GitHub MCP integration allows AI agents and assistants to interact with GitHub repositories, issues, pull requests, and other GitHub resources programmatically.

**Key Capabilities:**
- Read repository contents, commits, and file structures
- Search code, issues, and pull requests
- Manage GitHub Actions workflows
- Access and analyze code scanning alerts
- Retrieve workflow run logs and artifacts
- Interact with repository branches and tags

---

## Why Use GitHub MCP

### Benefits for Development Teams

1. **Automated Code Analysis**
   - AI agents can analyze codebases to understand structure and dependencies
   - Automated code reviews with context-aware suggestions
   - Security vulnerability detection and reporting

2. **Enhanced Issue Management**
   - Automatic issue triage and labeling
   - Context-aware issue responses
   - Link related issues and pull requests automatically

3. **Workflow Automation**
   - Monitor CI/CD pipelines programmatically
   - Analyze build failures and suggest fixes
   - Automated documentation updates based on code changes

4. **Improved Developer Experience**
   - Natural language queries about codebase
   - Intelligent code search across repositories
   - Quick access to project context and history

---

## Prerequisites

Before setting up GitHub MCP integration, ensure you have:

1. **GitHub Account**
   - Access to the repository you want to integrate with
   - Appropriate permissions (read/write based on use case)

2. **MCP-Compatible Tools**
   - Claude Desktop, GitHub Copilot, or other MCP-enabled AI assistants
   - Python 3.11+ (for custom MCP server implementations)

3. **GitHub Personal Access Token** (for authenticated requests)
   - Create at: https://github.com/settings/tokens
   - Required scopes: `repo`, `workflow`, `read:org`, `read:user`

---

## Setup and Configuration

### 1. Using GitHub MCP with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### 2. Using GitHub MCP with GitHub Copilot

GitHub Copilot automatically integrates with your repository when:
- Working in VS Code or supported IDE
- Authenticated with GitHub account
- Repository is open in the workspace

### 3. Custom MCP Server (Python)

For the ShiftWork project's custom MCP server, see [`python_client/MCP_SERVER.md`](./python_client/MCP_SERVER.md).

**Quick Start:**
```bash
cd python_client
pip install -r requirements.txt
python http_mcp_server.py --mode http --port 8080
```

---

## MCP Tools Available

### Repository Tools

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `get_file_contents` | Read file or directory contents | Get source code, configs, docs |
| `search_repositories` | Find repos by criteria | Discover similar projects |
| `list_commits` | Get commit history | Audit changes, find bugs |
| `get_commit` | Get detailed commit info | Review specific changes |

### Issue & PR Tools

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `list_issues` | List repository issues | Triage, assign, prioritize |
| `search_issues` | Search issues with filters | Find related bugs |
| `list_pull_requests` | List PRs with filters | Review queue management |
| `pull_request_read` | Get PR details and diff | Code review preparation |

### Actions & Workflows

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `list_workflows` | List available workflows | Monitor CI/CD |
| `list_workflow_runs` | Get workflow execution history | Debug failures |
| `get_job_logs` | Retrieve job logs | Diagnose build errors |
| `actions_get` | Get workflow/run/artifact details | Deep dive analysis |

### Code Analysis

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `search_code` | Fast code search across repos | Find patterns, functions |
| `list_code_scanning_alerts` | Security vulnerability scan | Identify security issues |
| `list_secret_scanning_alerts` | Exposed secrets detection | Prevent credential leaks |

---

## Best Practices

### 1. Security

✅ **DO:**
- Use environment variables for tokens (never commit to repo)
- Create tokens with minimal required scopes
- Rotate tokens regularly (every 90 days recommended)
- Use different tokens for different environments (dev/prod)

❌ **DON'T:**
- Hardcode tokens in configuration files
- Share tokens between team members
- Use personal tokens for production services (use GitHub Apps instead)

### 2. Rate Limiting

GitHub API has rate limits. Best practices:

- **Cache responses** where possible (5-10 minute cache for read-only data)
- **Use conditional requests** with `If-None-Match` headers
- **Implement exponential backoff** on rate limit errors
- **Monitor usage** via `X-RateLimit-*` response headers

Example rate limits:
- Authenticated: 5,000 requests/hour
- Search API: 30 requests/minute
- Actions API: varies by endpoint

### 3. Error Handling

```python
import httpx
from tenacity import retry, wait_exponential, stop_after_attempt

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(3)
)
async def call_github_api(endpoint):
    try:
        response = await http_client.get(endpoint)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            # Handle not found
            return None
        elif e.response.status_code == 403:
            # Check if rate limited
            if 'rate limit' in e.response.text.lower():
                raise  # Trigger retry
        raise
```

### 4. Query Optimization

- **Use specific filters** to reduce response size
- **Paginate results** (max 100 items per page)
- **Request only needed fields** when API supports it
- **Combine related queries** to minimize round trips

### 5. MCP Tool Design

When creating custom MCP tools:

1. **Clear naming**: Use descriptive tool names (e.g., `get_employee_schedules` not `emp_sched`)
2. **Type safety**: Use Pydantic models for input validation
3. **Error messages**: Return user-friendly error descriptions
4. **Documentation**: Provide clear tool descriptions and parameter schemas
5. **Idempotency**: Design tools to be safely called multiple times

---

## Common Workflows

### Workflow 1: Automated Issue Triage

**Goal:** Automatically label and assign new issues based on content.

```python
# MCP Tool: Triage new issues
async def triage_issue(issue_number: int, repo: str, owner: str):
    # 1. Get issue details
    issue = await github_mcp.issue_read(
        method="get",
        owner=owner,
        repo=repo,
        issue_number=issue_number
    )
    
    # 2. Analyze content with AI
    labels = []
    if "bug" in issue["title"].lower() or "error" in issue["body"].lower():
        labels.append("bug")
    if "feature" in issue["title"].lower():
        labels.append("enhancement")
    
    # 3. Determine component (example: mobile vs api vs frontend)
    if "mobile" in issue["body"].lower():
        labels.append("mobile")
    elif "api" in issue["body"].lower():
        labels.append("backend")
    elif "angular" in issue["body"].lower():
        labels.append("frontend")
    
    # 4. Assign based on labels (example logic)
    assignee = None
    if "mobile" in labels:
        assignee = "mobile-team-lead"
    elif "backend" in labels:
        assignee = "backend-team-lead"
    
    return {
        "suggested_labels": labels,
        "suggested_assignee": assignee,
        "priority": "high" if "urgent" in issue["title"].lower() else "normal"
    }
```

### Workflow 2: CI/CD Failure Analysis

**Goal:** Automatically analyze failed workflow runs and suggest fixes.

```python
# MCP Tool: Analyze workflow failure
async def analyze_workflow_failure(owner: str, repo: str, run_id: int):
    # 1. Get workflow run details
    run = await github_mcp.actions_get(
        method="get_workflow_run",
        owner=owner,
        repo=repo,
        resource_id=str(run_id)
    )
    
    # 2. Get failed job logs
    logs = await github_mcp.get_job_logs(
        owner=owner,
        repo=repo,
        run_id=run_id,
        failed_only=True,
        return_content=True,
        tail_lines=100
    )
    
    # 3. Analyze common failure patterns
    failures = []
    for job_log in logs["job_logs"]:
        log_content = job_log["content"]
        
        if "npm ERR!" in log_content:
            failures.append({
                "type": "dependency_error",
                "job": job_log["job_name"],
                "suggestion": "Check package.json and run 'npm install'"
            })
        elif "error CS" in log_content:
            failures.append({
                "type": "compilation_error",
                "job": job_log["job_name"],
                "suggestion": "C# compilation failed. Review recent code changes."
            })
        elif "Test failed" in log_content:
            failures.append({
                "type": "test_failure",
                "job": job_log["job_name"],
                "suggestion": "Tests failing. Review test logs for details."
            })
    
    return {
        "run_id": run_id,
        "status": run["status"],
        "conclusion": run["conclusion"],
        "failures": failures
    }
```

### Workflow 3: Automated Documentation Updates

**Goal:** Keep documentation in sync with code changes.

```python
# MCP Tool: Check if documentation needs update
async def check_doc_freshness(owner: str, repo: str, file_path: str):
    # 1. Get file last modified date
    commits = await github_mcp.list_commits(
        owner=owner,
        repo=repo,
        path=file_path,
        perPage=1
    )
    
    last_code_update = commits[0]["commit"]["committer"]["date"]
    
    # 2. Check related documentation
    doc_path = file_path.replace("src/", "docs/").replace(".cs", ".md")
    
    try:
        doc_commits = await github_mcp.list_commits(
            owner=owner,
            repo=repo,
            path=doc_path,
            perPage=1
        )
        last_doc_update = doc_commits[0]["commit"]["committer"]["date"]
        
        # 3. Compare dates
        if last_code_update > last_doc_update:
            return {
                "status": "outdated",
                "message": f"Code updated on {last_code_update} but docs last updated on {last_doc_update}",
                "action": "review_and_update_docs"
            }
    except:
        return {
            "status": "missing",
            "message": f"No documentation found at {doc_path}",
            "action": "create_documentation"
        }
    
    return {
        "status": "up_to_date",
        "message": "Documentation is current"
    }
```

### Workflow 4: Security Alert Monitoring

**Goal:** Monitor and respond to security vulnerabilities.

```python
# MCP Tool: Security dashboard
async def get_security_summary(owner: str, repo: str):
    # 1. Get code scanning alerts
    code_alerts = await github_mcp.list_code_scanning_alerts(
        owner=owner,
        repo=repo,
        state="open"
    )
    
    # 2. Get secret scanning alerts
    secret_alerts = await github_mcp.list_secret_scanning_alerts(
        owner=owner,
        repo=repo,
        state="open"
    )
    
    # 3. Categorize by severity
    summary = {
        "critical": [],
        "high": [],
        "medium": [],
        "low": []
    }
    
    for alert in code_alerts:
        severity = alert.get("rule", {}).get("severity", "low")
        summary[severity].append({
            "type": "code_scanning",
            "number": alert["number"],
            "description": alert["rule"]["description"],
            "location": alert["most_recent_instance"]["location"]["path"]
        })
    
    for alert in secret_alerts:
        summary["critical"].append({
            "type": "secret_exposed",
            "number": alert["number"],
            "secret_type": alert["secret_type"],
            "location": alert.get("locations", [{}])[0].get("details", {}).get("path", "unknown")
        })
    
    return {
        "total_alerts": len(code_alerts) + len(secret_alerts),
        "by_severity": summary,
        "requires_immediate_action": len(summary["critical"]) > 0
    }
```

---

## Integration with ShiftWork

### Current MCP Implementation

The ShiftWork project has a custom MCP server in `python_client/` that bridges between:
- Mobile app (React Native)
- AI agents (via MCP protocol)
- Backend API (.NET Core)

**Key Features:**
- HTTP REST endpoints for mobile consumption
- MCP stdio protocol for AI agents
- Dual-mode operation (HTTP + MCP concurrently)

**Custom Tools:**
1. `get_employee_schedules` - Retrieve schedules for a specific employee
2. `get_people_with_unpublished_schedules` - Find unpublished schedule gaps
3. `ping` - Health check

### Extending ShiftWork MCP

To add a new tool (example: `get_shift_coverage`):

**Step 1: Define the tool schema**
```python
# In http_mcp_server.py _setup_handlers()
Tool(
    name="get_shift_coverage",
    description="Get shift coverage status for a location and date range",
    inputSchema={
        "type": "object",
        "properties": {
            "company_id": {
                "type": "string",
                "description": "Company ID"
            },
            "location_id": {
                "type": "string",
                "description": "Location ID to check coverage"
            },
            "start_date": {
                "type": "string",
                "description": "Start date (ISO format)"
            },
            "end_date": {
                "type": "string",
                "description": "End date (ISO format)"
            }
        },
        "required": ["company_id", "location_id", "start_date", "end_date"]
    }
)
```

**Step 2: Implement the tool**
```python
async def _get_shift_coverage_impl(self, arguments: dict):
    company_id = arguments["company_id"]
    location_id = arguments["location_id"]
    start_date = arguments["start_date"]
    end_date = arguments["end_date"]
    
    # Call .NET API
    client = await self._get_http_client()
    response = await client.get(
        f"{self.api_base_url}/api/companies/{company_id}/schedules/coverage",
        params={
            "locationId": location_id,
            "startDate": start_date,
            "endDate": end_date
        }
    )
    response.raise_for_status()
    data = response.json()
    
    return {
        "company_id": company_id,
        "location_id": location_id,
        "date_range": f"{start_date} to {end_date}",
        "coverage": data,
        "timestamp": datetime.now().isoformat()
    }
```

**Step 3: Add to call_tool dispatcher**
```python
elif name == "get_shift_coverage":
    result = await self._get_shift_coverage_impl(arguments)
```

**Step 4: Test the tool**
```bash
# Test via HTTP
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_shift_coverage",
    "arguments": {
      "company_id": "abc123",
      "location_id": "10",
      "start_date": "2026-02-14",
      "end_date": "2026-02-21"
    }
  }'
```

---

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Symptom:** `401 Unauthorized` or `403 Forbidden`

**Solutions:**
- Verify token is valid and not expired
- Check token has required scopes
- For GitHub Apps, verify installation permissions
- Test token with: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user`

#### 2. Rate Limiting

**Symptom:** `403 API rate limit exceeded`

**Solutions:**
- Check current limits: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit`
- Implement caching for frequently accessed data
- Use conditional requests with `If-None-Match`
- Consider GitHub Apps for higher limits (15,000/hour)

#### 3. MCP Server Connection Issues

**Symptom:** Tool calls time out or fail to connect

**Solutions:**
- Verify server is running: `curl http://localhost:8080/health`
- Check firewall/network settings
- Verify `API_BASE_URL` environment variable
- Check logs for error messages
- Ensure .NET API is accessible from MCP server

#### 4. Missing or Incomplete Data

**Symptom:** API returns empty results or missing fields

**Solutions:**
- Verify query parameters are correct
- Check pagination (may need multiple requests)
- Ensure user has access to the resource
- Review API response for error messages
- Check if resource actually exists

---

## Additional Resources

### Official Documentation
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [GitHub Actions API](https://docs.github.com/en/rest/actions)

### ShiftWork Documentation
- [MCP Server Architecture](./python_client/MCP_SERVER.md)
- [Agent Guide](./AGENT.md)
- [Mobile AI Chat](./ShiftWork.Mobile/README.md#ai-chat)

### Community Resources
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [GitHub REST API Examples](https://github.com/octokit/rest.js)
- [Anthropic Claude MCP Guide](https://docs.anthropic.com/claude/docs/mcp)

### Tools and Libraries
- **Python:** `httpx`, `mcp` SDK, `PyGithub`
- **JavaScript:** `@octokit/rest`, `@modelcontextprotocol/sdk`
- **C#:** `Octokit.NET`

### Best Practices Guides
- [GitHub API Best Practices](https://docs.github.com/en/rest/guides/best-practices-for-integrators)
- [Rate Limiting Guide](https://docs.github.com/en/rest/guides/best-practices-for-integrators#dealing-with-rate-limits)
- [Webhook Best Practices](https://docs.github.com/en/webhooks-and-events/webhooks/best-practices-for-using-webhooks)

---

## Support

For questions or issues:
1. Check [GitHub Discussions](https://github.com/williamag929/BaseShiftWork/discussions)
2. Review [existing issues](https://github.com/williamag929/BaseShiftWork/issues)
3. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, versions, etc.)
   - Relevant logs or error messages

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Maintained By:** ShiftWork Development Team
