# Quick Start Guide: GitHub MCP and Issues

This is a quick reference guide to get you started with GitHub MCP integration and effective issue management. For comprehensive documentation, see the full guides.

## 📚 Full Documentation

- **[GITHUB_MCP_GUIDE.md](./GITHUB_MCP_GUIDE.md)** - Complete MCP integration guide
- **[GITHUB_ISSUES_GUIDE.md](./GITHUB_ISSUES_GUIDE.md)** - Comprehensive issues guide
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute

---

## 🚀 Quick Start: GitHub MCP

### What is GitHub MCP?

Model Context Protocol (MCP) allows AI agents to interact with GitHub repositories programmatically. It enables:
- Code analysis and search
- Issue and PR management
- Workflow automation
- Security scanning

### Setup in 5 Minutes

**1. Install MCP Server (Python)**
```bash
cd python_client
pip install -r requirements.txt
python http_mcp_server.py --mode http --port 8080
```

**2. Test the connection**
```bash
curl http://localhost:8080/health
```

**3. Use available tools**
```bash
# List all tools
curl http://localhost:8080/api/tools

# Execute a tool
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_employee_schedules",
    "arguments": {
      "company_id": "abc123",
      "person_id": "8"
    }
  }'
```

### Common MCP Tools

| Tool | Purpose |
|------|---------|
| `get_file_contents` | Read files from repository |
| `search_code` | Search code across repo |
| `list_issues` | List repository issues |
| `list_workflow_runs` | Monitor CI/CD status |
| `get_job_logs` | Debug build failures |

---

## 📝 Quick Start: GitHub Issues

### Creating a Good Issue

**1. Use the right template**
- 🐛 Bug Report - for bugs and errors
- ✨ Feature Request - for new features
- 📝 Documentation - for docs improvements

**2. Include essential information**
- **Title:** Clear and descriptive
- **Description:** What, why, and how
- **Context:** Environment, steps to reproduce
- **Examples:** Code, screenshots, logs

**3. Label appropriately**
- Component: `mobile`, `frontend`, `backend`, `mcp`
- Type: `bug`, `enhancement`, `documentation`
- Priority: `priority: high`, `priority: medium`, `priority: low`

### Issue Lifecycle

```
Create → Triage → Label → Assign → Work → Review → Close
```

### Quick Tips

✅ **DO:**
- Search existing issues first
- Be specific and provide context
- Use markdown formatting
- Link related issues
- Update when you have new info

❌ **DON'T:**
- Create duplicate issues
- Use vague titles like "doesn't work"
- Assume context everyone knows
- Mix multiple unrelated issues
- Spam with @mentions

---

## 🔧 Common Workflows

### Workflow 1: Report a Bug

```markdown
1. Click "New Issue"
2. Select "Bug Report" template
3. Fill in:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Error logs/screenshots
4. Add labels: `bug`, component label
5. Submit
```

### Workflow 2: Request a Feature

```markdown
1. Click "New Issue"
2. Select "Feature Request" template
3. Fill in:
   - User story (As a X, I want Y, so that Z)
   - Problem statement
   - Proposed solution
   - Acceptance criteria
4. Add labels: `enhancement`, component label
5. Submit
```

### Workflow 3: MCP Issue Automation

```python
# Auto-triage issues with MCP
from github_mcp import search_issues, issue_read

# Find untriaged issues
issues = await search_issues(
    query="repo:williamag929/BaseShiftWork is:issue is:open no:label"
)

for issue in issues["items"]:
    # Analyze content
    text = f"{issue['title']} {issue['body']}".lower()
    
    # Auto-label based on keywords
    if "mobile" in text:
        # Add mobile label
    if "bug" in text or "error" in text:
        # Add bug label
```

---

## 🎯 Best Practices Summary

### MCP Integration

1. **Security First**
   - Use environment variables for tokens
   - Never commit secrets
   - Rotate tokens regularly

2. **Rate Limiting**
   - Cache responses (5-10 minutes)
   - Use conditional requests
   - Implement exponential backoff

3. **Error Handling**
   - Handle 404, 403, 429 errors
   - Retry with backoff
   - Log errors for debugging

### Issue Management

1. **Write Clear Titles**
   - Include component and issue type
   - Be specific, not vague
   - Example: "Clock-in fails with null location"

2. **Provide Context**
   - Environment details
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs/screenshots

3. **Use Labels Effectively**
   - Component: mobile, frontend, backend
   - Type: bug, enhancement, documentation
   - Priority: high, medium, low
   - Status: needs-triage, ready, in-progress

4. **Keep Issues Focused**
   - One issue = one problem/feature
   - Link related issues
   - Use tracking issues for coordination

---

## 📖 Learn More

### Essential Reading

- **[GITHUB_MCP_GUIDE.md](./GITHUB_MCP_GUIDE.md)** - Complete MCP guide
  - Detailed setup instructions
  - Advanced workflows
  - Troubleshooting guide
  - Integration examples

- **[GITHUB_ISSUES_GUIDE.md](./GITHUB_ISSUES_GUIDE.md)** - Complete issues guide
  - Issue lifecycle
  - Label strategy
  - Milestones and projects
  - MCP automation examples

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guide
  - Development workflow
  - Coding standards
  - Testing requirements
  - Pull request process

### ShiftWork-Specific Docs

- **[AGENT.md](./AGENT.md)** - AI agent guide
- **[MCP_SERVER.md](./python_client/MCP_SERVER.md)** - MCP server architecture
- **[README.md](./README.md)** - Project overview

---

## ❓ Need Help?

1. **Check Documentation** - Start with the guides above
2. **Search Issues** - Someone may have asked before
3. **Ask in Discussions** - For questions and ideas
4. **Create an Issue** - For bugs and feature requests

---

**Quick Reference Version:** 1.0  
**Last Updated:** February 2026  
**For Full Details:** See complete guides linked above
