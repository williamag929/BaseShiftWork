# GitHub Issues Best Practices Guide

## Table of Contents
1. [Introduction to GitHub Issues](#introduction-to-github-issues)
2. [Why Use GitHub Issues](#why-use-github-issues)
3. [Issue Lifecycle](#issue-lifecycle)
4. [Creating Effective Issues](#creating-effective-issues)
5. [Issue Templates](#issue-templates)
6. [Labels and Organization](#labels-and-organization)
7. [Milestones and Projects](#milestones-and-projects)
8. [Issue Workflow Integration](#issue-workflow-integration)
9. [MCP Integration for Issues](#mcp-integration-for-issues)
10. [Best Practices](#best-practices)
11. [Common Patterns](#common-patterns)

---

## Introduction to GitHub Issues

GitHub Issues is a powerful tracking system for managing work on your repository. It goes beyond simple bug tracking to serve as a comprehensive project management tool.

**What can you track with Issues:**
- 🐛 Bug reports and defects
- ✨ Feature requests and enhancements
- 📝 Documentation needs
- ❓ Questions and discussions
- 🚀 Release planning and roadmaps
- 🔒 Security vulnerabilities
- 🎯 Technical debt and refactoring

---

## Why Use GitHub Issues

### Advantages

1. **Integrated with Code**
   - Direct links to commits, branches, and pull requests
   - Automatic closure via commit messages (`fixes #123`)
   - Context-aware discussions linked to specific code

2. **Transparent Communication**
   - Public visibility for open-source projects
   - Private issues for sensitive topics (GitHub Enterprise)
   - @mentions for team collaboration
   - Email notifications for updates

3. **Flexible Organization**
   - Custom labels for categorization
   - Milestones for release planning
   - Projects for kanban-style boards
   - Assignees for ownership tracking

4. **Powerful Search**
   - Full-text search across titles and descriptions
   - Advanced filters (state, label, assignee, author, etc.)
   - Saved searches for common queries
   - API access for automation

5. **Automation Ready**
   - GitHub Actions integration
   - Webhook events for external systems
   - MCP protocol for AI agents
   - Third-party integrations (Slack, Jira, etc.)

---

## Issue Lifecycle

```
┌──────────────┐
│ Idea/Problem │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌─────────────┐
│ Issue Opened │────▶│ Needs Triage│
└──────┬───────┘     └─────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   Triaged    │────▶│   Labeled    │
└──────┬───────┘     └──────────────┘
       │
       ├─────────────────┬──────────────────┬─────────────┐
       ▼                 ▼                  ▼             ▼
┌──────────┐      ┌────────────┐    ┌──────────┐  ┌─────────┐
│ Assigned │      │Won't Fix   │    │Duplicate │  │Question │
└────┬─────┘      └────────────┘    └──────────┘  └─────────┘
     │
     ▼
┌──────────────┐
│ In Progress  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  PR Created  │────▶│  In Review   │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│    Merged    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Closed    │
└──────────────┘
```

### States

1. **Open** - Issue is active and needs attention
2. **Closed** - Issue is resolved or no longer relevant
3. **Locked** - Issue is closed and no longer accepts comments

### Common Closing Reasons

- ✅ **Completed** - Fixed, implemented, or resolved
- 🔄 **Duplicate** - Covered by another issue
- 🚫 **Won't Fix** - Out of scope or not planned
- ❓ **Answered** - Question resolved
- 🗑️ **Invalid** - Not a real issue or spam

---

## Creating Effective Issues

### The Golden Rule
**Write issues as if you're explaining to a future version of yourself who has forgotten all context.**

### Essential Components

#### 1. Clear Title
```
❌ Bad:  "Bug in schedule"
✅ Good: "Clock-in fails with NullReferenceException when location is not set"

❌ Bad:  "Add feature"
✅ Good: "Add biometric authentication to mobile clock-in"

❌ Bad:  "Question"
✅ Good: "How to configure SMTP for email notifications?"
```

#### 2. Detailed Description

**For Bugs:**
```markdown
## Description
Brief summary of the issue

## Steps to Reproduce
1. Navigate to /kiosk
2. Select employee "John Doe"
3. Click "Clock In" without selecting a location
4. Error occurs

## Expected Behavior
Should prompt user to select a location before proceeding

## Actual Behavior
Application crashes with NullReferenceException

## Environment
- OS: Windows 11
- Browser: Chrome 120.0
- API Version: 2.1.0
- Database: SQL Server 2022

## Screenshots
[Include relevant screenshots]

## Logs
```
Error: System.NullReferenceException at ShiftWork.Api.Controllers.KioskController.CreateShiftEvent
```

## Possible Fix
Add null check for `location` parameter before creating shift event
```

**For Features:**
```markdown
## User Story
As a [type of user], I want [goal] so that [benefit]

Example:
As a manager, I want to receive notifications when employees request time off 
so that I can approve/deny requests promptly

## Acceptance Criteria
- [ ] Manager receives email notification on new time-off request
- [ ] Notification includes employee name, dates, and reason
- [ ] Notification contains links to approve/deny in web app
- [ ] Push notification sent if manager has mobile app installed
- [ ] Notification preferences configurable in settings

## Design Mockups
[Include wireframes or screenshots if available]

## Technical Notes
- Use existing NotificationService with "timeoff_request" channel
- Template in appsettings: TimeOffRequest.EmailTemplate
- Mobile push via Firebase Cloud Messaging

## Dependencies
- Requires NotificationService (already implemented)
- May need new email template
```

#### 3. Context and References

Link related items:
- Related issues: `Relates to #45`, `Depends on #67`
- Pull requests: `Implemented in #89`
- Documentation: `See AGENT.md section on notifications`
- External resources: Links to Stack Overflow, documentation, etc.

---

## Issue Templates

Issue templates standardize reporting and ensure all necessary information is collected.

### Setting Up Templates

Create `.github/ISSUE_TEMPLATE/` directory with template files:

**1. Bug Report Template** (`.github/ISSUE_TEMPLATE/bug_report.md`)
```markdown
---
name: Bug Report
about: Report a bug or unexpected behavior
title: '[BUG] '
labels: bug, needs-triage
assignees: ''
---

## Description
A clear and concise description of the bug

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- **OS:** 
- **Browser/App Version:** 
- **API Version:** 
- **Database:** 

## Screenshots
If applicable, add screenshots

## Logs/Error Messages
```
Paste relevant logs here
```

## Possible Cause/Fix
If you have investigated, share findings

## Additional Context
Any other relevant information
```

**2. Feature Request Template** (`.github/ISSUE_TEMPLATE/feature_request.md`)
```markdown
---
name: Feature Request
about: Suggest a new feature or enhancement
title: '[FEATURE] '
labels: enhancement, needs-triage
assignees: ''
---

## User Story
As a [user type], I want [goal] so that [benefit]

## Problem Statement
What problem does this solve?

## Proposed Solution
How should this work?

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Alternatives Considered
Other approaches that were considered

## Design/Mockups
Include wireframes, sketches, or examples

## Technical Considerations
- Dependencies
- Breaking changes
- Performance impact
- Security concerns

## Priority
- [ ] Critical - Blocking users
- [ ] High - Important for upcoming release
- [ ] Medium - Nice to have
- [ ] Low - Future consideration
```

**3. Documentation Template** (`.github/ISSUE_TEMPLATE/documentation.md`)
```markdown
---
name: Documentation
about: Improve or add documentation
title: '[DOCS] '
labels: documentation
assignees: ''
---

## What needs documentation?
Be specific about the area/feature

## Current State
What exists now (if anything)?

## Desired State
What should be documented?

## Target Audience
- [ ] End users
- [ ] Developers
- [ ] API consumers
- [ ] System administrators

## Suggested Structure
Outline or table of contents

## Related Code/Features
Links to relevant files or features

## Examples to Include
Code samples, screenshots, or use cases
```

**4. Config File** (`.github/ISSUE_TEMPLATE/config.yml`)
```yaml
blank_issues_enabled: false
contact_links:
  - name: 💬 Discussions
    url: https://github.com/williamag929/BaseShiftWork/discussions
    about: For questions and general discussion
  - name: 🔒 Security Issue
    url: https://github.com/williamag929/BaseShiftWork/security/advisories/new
    about: Report a security vulnerability privately
```

---

## Labels and Organization

### Label Strategy

#### By Type
- `bug` 🐛 - Something isn't working
- `enhancement` ✨ - New feature or request
- `documentation` 📝 - Documentation improvements
- `question` ❓ - Further information is requested
- `security` 🔒 - Security vulnerability or concern

#### By Component
- `mobile` 📱 - React Native mobile app
- `frontend` 🎨 - Angular web frontend
- `backend` ⚙️ - .NET Core API
- `database` 🗄️ - Database schema or queries
- `mcp` 🤖 - Python MCP server

#### By Priority
- `priority: critical` 🔴 - Blocking production
- `priority: high` 🟠 - Important for next release
- `priority: medium` 🟡 - Should address soon
- `priority: low` 🟢 - Nice to have

#### By Status
- `needs-triage` 🏷️ - Needs initial review
- `needs-reproduction` 🔍 - Can't reproduce, need more info
- `ready` ✅ - Ready to work on
- `in-progress` 🚧 - Currently being worked on
- `blocked` 🚫 - Waiting on external dependency
- `wont-fix` ⛔ - Will not be addressed

#### By Effort
- `good first issue` 🌱 - Good for new contributors
- `help wanted` 🆘 - Extra attention needed
- `effort: small` - < 1 day
- `effort: medium` - 1-3 days
- `effort: large` - > 3 days

### Label Management

**Creating Labels:**
```bash
# Via GitHub CLI
gh label create "mobile" --description "React Native mobile app" --color "0075ca"
gh label create "priority: high" --description "Important for next release" --color "ff9500"
```

**Bulk Label Operations:**
```bash
# Add label to multiple issues
gh issue edit 123 124 125 --add-label "mobile,bug"

# Remove label
gh issue edit 123 --remove-label "needs-triage"
```

---

## Milestones and Projects

### Milestones

Use milestones for release planning and time-bound goals.

**Example Milestones:**
- `v2.0.0 - Q1 2026` - Major release with breaking changes
- `v1.5.0 - February 2026` - Minor feature release
- `Bug Fixes - Rolling` - Ongoing bug fixes
- `Technical Debt` - Cleanup and refactoring

**Creating a Milestone:**
```bash
gh api repos/williamag929/BaseShiftWork/milestones -f title="v2.0.0" -f due_on="2026-03-31T23:59:59Z" -f description="Major release with MCP improvements"
```

### GitHub Projects

Projects provide kanban-style boards for visual workflow management.

**Example Project Board:**
```
┌─────────────┬──────────────┬─────────────┬──────────┬────────┐
│  Backlog    │  To Do       │ In Progress │  Review  │  Done  │
├─────────────┼──────────────┼─────────────┼──────────┼────────┤
│ #123 Bug    │ #125 Feature │ #127 API    │ #128 PR  │ #130   │
│ #124 Docs   │ #126 Mobile  │             │ #129 PR  │ #131   │
│             │              │             │          │ #132   │
└─────────────┴──────────────┴─────────────┴──────────┴────────┘
```

**Automation Rules:**
- Move to "To Do" when issue is assigned
- Move to "In Progress" when PR is opened
- Move to "Review" when PR is marked ready
- Move to "Done" when PR is merged

---

## Issue Workflow Integration

### 1. Linking Issues to Commits

**In commit messages:**
```bash
# Close an issue
git commit -m "Fix null check in clock-in (fixes #123)"

# Reference without closing
git commit -m "Add logging for issue #124"
```

**Keywords that close issues:**
- `close`, `closes`, `closed`
- `fix`, `fixes`, `fixed`
- `resolve`, `resolves`, `resolved`

### 2. Linking Issues to Pull Requests

**In PR description:**
```markdown
## Changes
- Add biometric authentication to mobile app
- Update dependencies

## Related Issues
Closes #145
Relates to #67
Depends on #89
```

### 3. Cross-Repository Links

Reference issues in other repos:
```
See williamag929/OtherRepo#45
Implemented in modelcontextprotocol/servers#12
```

### 4. GitHub Actions Integration

**Auto-label based on file changes:**
```yaml
name: Auto Label
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v4
        with:
          repo-token: "${{ secrets.GITHUB_TOKEN }}"
          configuration-path: .github/labeler.yml
```

**.github/labeler.yml:**
```yaml
mobile:
  - ShiftWork.Mobile/**/*

backend:
  - ShiftWork.Api/**/*

frontend:
  - ShiftWork.Angular/**/*

documentation:
  - '**/*.md'
```

---

## MCP Integration for Issues

### Using GitHub MCP Tools for Issue Management

#### 1. Automated Issue Triage

```python
from mcp import ClientSession

async def triage_new_issues():
    """
    Automatically triage new issues based on content
    """
    # Get all open, unlabeled issues
    issues = await github_mcp.search_issues(
        query="repo:williamag929/BaseShiftWork is:issue is:open no:label"
    )
    
    for issue in issues["items"]:
        labels = []
        
        # Analyze title and body
        text = f"{issue['title']} {issue['body']}".lower()
        
        # Component detection
        if "mobile" in text or "react native" in text:
            labels.append("mobile")
        if "angular" in text or "kiosk" in text:
            labels.append("frontend")
        if "api" in text or ".net" in text:
            labels.append("backend")
        
        # Type detection
        if any(word in text for word in ["bug", "error", "exception", "crash"]):
            labels.append("bug")
        elif any(word in text for word in ["feature", "add", "implement"]):
            labels.append("enhancement")
        elif any(word in text for word in ["doc", "readme", "guide"]):
            labels.append("documentation")
        
        # Priority detection
        if any(word in text for word in ["urgent", "critical", "production"]):
            labels.append("priority: high")
        
        print(f"Issue #{issue['number']}: {labels}")
        
        # Apply labels (via GitHub API)
        # gh api repos/williamag929/BaseShiftWork/issues/{number}/labels -f labels[]=...
```

#### 2. Issue Search and Filtering

```python
async def find_related_issues(issue_number: int):
    """
    Find issues related to a specific issue
    """
    # Get the issue details
    issue = await github_mcp.issue_read(
        method="get",
        owner="williamag929",
        repo="BaseShiftWork",
        issue_number=issue_number
    )
    
    # Extract keywords from title
    keywords = issue["title"].split()
    
    # Search for similar issues
    query = f"repo:williamag929/BaseShiftWork is:issue {' '.join(keywords[:3])}"
    similar = await github_mcp.search_issues(query=query, perPage=10)
    
    return {
        "original": issue,
        "similar_issues": [
            {
                "number": i["number"],
                "title": i["title"],
                "state": i["state"],
                "url": i["html_url"]
            }
            for i in similar["items"]
            if i["number"] != issue_number
        ]
    }
```

#### 3. Stale Issue Detection

```python
from datetime import datetime, timedelta

async def find_stale_issues(days_inactive: int = 90):
    """
    Find issues with no activity for specified days
    """
    cutoff_date = datetime.now() - timedelta(days=days_inactive)
    cutoff_iso = cutoff_date.strftime("%Y-%m-%d")
    
    # Search for old, open issues
    issues = await github_mcp.search_issues(
        query=f"repo:williamag929/BaseShiftWork is:issue is:open updated:<{cutoff_iso}",
        sort="updated",
        order="asc"
    )
    
    stale = []
    for issue in issues["items"]:
        last_update = datetime.fromisoformat(issue["updated_at"].replace("Z", "+00:00"))
        days_old = (datetime.now() - last_update.replace(tzinfo=None)).days
        
        stale.append({
            "number": issue["number"],
            "title": issue["title"],
            "days_inactive": days_old,
            "url": issue["html_url"],
            "labels": [label["name"] for label in issue["labels"]]
        })
    
    return {
        "total_stale": len(stale),
        "issues": stale,
        "suggested_action": "Comment asking for updates or close if no longer relevant"
    }
```

#### 4. Release Planning Assistant

```python
async def plan_release(milestone_name: str):
    """
    Generate release notes from milestone issues
    """
    # Get issues in milestone
    issues = await github_mcp.search_issues(
        query=f"repo:williamag929/BaseShiftWork is:closed milestone:\"{milestone_name}\"",
        sort="created",
        order="asc"
    )
    
    # Categorize by label
    features = []
    bugs = []
    docs = []
    other = []
    
    for issue in issues["items"]:
        labels = [label["name"] for label in issue["labels"]]
        item = f"- {issue['title']} (#{issue['number']})"
        
        if "enhancement" in labels:
            features.append(item)
        elif "bug" in labels:
            bugs.append(item)
        elif "documentation" in labels:
            docs.append(item)
        else:
            other.append(item)
    
    # Generate release notes
    notes = f"# Release Notes - {milestone_name}\n\n"
    
    if features:
        notes += "## ✨ New Features\n" + "\n".join(features) + "\n\n"
    if bugs:
        notes += "## 🐛 Bug Fixes\n" + "\n".join(bugs) + "\n\n"
    if docs:
        notes += "## 📝 Documentation\n" + "\n".join(docs) + "\n\n"
    if other:
        notes += "## 🔧 Other Changes\n" + "\n".join(other) + "\n\n"
    
    return notes
```

---

## Best Practices

### 1. Writing Clear Titles

**Do's:**
- Be specific and descriptive
- Include component/area affected
- Use active voice
- Include error messages for bugs

**Don'ts:**
- Use vague terms like "doesn't work"
- ALL CAPS or excessive punctuation!!!
- Assume context that isn't in the title

### 2. Providing Context

**Always include:**
- Environment details (OS, browser, versions)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages
- Screenshots or videos for UI issues

### 3. Using @mentions Wisely

**When to @mention:**
- You need specific expertise
- Following up on a previous conversation
- Critical blocking issue needs attention

**When not to:**
- Initial issue creation (let triage process work)
- Multiple people (creates notification spam)
- Every comment (becomes noise)

### 4. Keeping Issues Focused

**One issue = One problem/feature**

If you find multiple issues:
- Create separate issues
- Link them together with "Relates to #XXX"
- Use a tracking issue for coordination

### 5. Updating Status

Keep the issue current:
- Update if you find more information
- Comment if you're working on it
- Close if it's resolved or no longer relevant
- Add "wont-fix" label with explanation if not addressing

### 6. Using Checklists

Great for tracking multi-step work:
```markdown
## Implementation Checklist
- [x] Backend API endpoint
- [x] Database migration
- [ ] Frontend UI component
- [ ] Mobile app integration
- [ ] Documentation
- [ ] Tests
```

### 7. Code Examples

Always use syntax highlighting:
```markdown
```python
# Python code here
```

```csharp
// C# code here
```

```typescript
// TypeScript code here
```
````

---

## Common Patterns

### Pattern 1: Epic Issue

For large features, create an "epic" issue that tracks sub-issues:

```markdown
## Epic: Biometric Authentication for Mobile

### Overview
Implement fingerprint and Face ID authentication for quick mobile login

### Sub-Issues
- [ ] #234 - Research biometric libraries for React Native
- [ ] #235 - Design biometric flow UX
- [ ] #236 - Implement fingerprint auth (Android)
- [ ] #237 - Implement Face ID (iOS)
- [ ] #238 - Add fallback to PIN
- [ ] #239 - Update security documentation
- [ ] #240 - Add biometric settings to profile

### Progress
Completed: 2/7 (28%)
```

### Pattern 2: Question → Documentation

When questions arise:
1. Answer in issue comments
2. Mark with "documentation" label
3. Create/update docs
4. Link to new documentation
5. Close issue

### Pattern 3: Bug → Test Case

For bugs:
1. Create failing test that reproduces bug
2. Commit test (marked as skip/ignore)
3. Fix the bug
4. Enable the test
5. Reference issue in test comments

```csharp
// Regression test for issue #123
[Fact]
public void ClockIn_WithoutLocation_ShouldPromptForLocation()
{
    // Arrange
    var employee = CreateTestEmployee();
    // Location intentionally null (issue #123)
    
    // Act & Assert
    var ex = Assert.Throws<ValidationException>(() => 
        kioskController.ClockIn(employee.Id, location: null));
    
    Assert.Contains("location", ex.Message.ToLower());
}
```

### Pattern 4: Security Issue

For security vulnerabilities:
1. **Don't** create public issue
2. Use GitHub Security Advisories
3. Report privately to maintainers
4. Allow time for fix before disclosure
5. Credit reporter in release notes

---

## Summary Checklist

Before creating an issue, ask yourself:

- [ ] Is this a duplicate? (Search existing issues first)
- [ ] Is the title clear and descriptive?
- [ ] Have I provided all necessary context?
- [ ] Are there steps to reproduce (for bugs)?
- [ ] Have I included relevant code/logs?
- [ ] Is this one focused issue (not multiple)?
- [ ] Have I suggested appropriate labels?
- [ ] Is this the right repository?
- [ ] Could this be a discussion instead?

---

## Additional Resources

### GitHub Documentation
- [Mastering Issues](https://guides.github.com/features/issues/)
- [About Issue Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [Linking Pull Requests to Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)
- [About Task Lists](https://docs.github.com/en/issues/tracking-your-work-with-issues/about-task-lists)

### Related ShiftWork Documentation
- [GitHub MCP Guide](./GITHUB_MCP_GUIDE.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Agent Guide](./AGENT.md)

### Tools
- [GitHub CLI](https://cli.github.com/) - Manage issues from command line
- [Hub](https://hub.github.com/) - Git wrapper with GitHub features
- [Octokit](https://github.com/octokit) - GitHub API libraries

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Maintained By:** ShiftWork Development Team
