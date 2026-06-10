# GitHub Wiki Update Instructions

This document provides step-by-step instructions for populating the GitHub Wiki based on the repository documentation.

## Overview

The ShiftWork repository now has comprehensive documentation and a complete Wiki Content Guide that maps all documentation to suggested wiki pages. This document explains how to manually update the GitHub Wiki.

## What Was Completed

### ✅ Copilot Instructions Enhanced
- **File:** `.github/copilot-instructions.md`
- **Changes:**
  - Added quick reference to Wiki Content Guide
  - Enhanced architecture section with bullet points and component details
  - Updated developer workflows to support Windows/macOS/Linux
  - Added detailed environment variable requirements
  - Improved project conventions with better formatting
  - Added cross-component integration details
  - Included comprehensive documentation file references
  - Fixed all documentation link paths to use relative `../` references

### ✅ Wiki Content Guide Created
- **File:** `WIKI_CONTENT_GUIDE.md`
- **Purpose:** Complete blueprint for GitHub Wiki population
- **Contents:**
  - Recommended wiki structure (14 main pages)
  - Content for each wiki page with sources
  - Documentation file mapping table
  - Sidebar navigation structure
  - Maintenance notes and best practices
  - Manual update instructions

### ✅ README Updated
- Added reference to Wiki Content Guide in documentation section

### ✅ All Documentation Validated
- Verified all existing documentation files are present
- Validated internal links in copilot-instructions.md
- Confirmed comprehensive coverage of all repository components

## Why GitHub Wiki Needs Manual Update

**Important:** The GitHub Wiki is stored in a separate git repository (`.wiki.git`) and cannot be updated programmatically through this PR. The wiki must be manually populated using the provided Wiki Content Guide.

## How to Update the GitHub Wiki

### Prerequisites
- GitHub account with write access to the repository
- Access to https://github.com/williamag929/BaseShiftWork/wiki

### Step-by-Step Instructions

#### 1. Access the Wiki

1. Navigate to: https://github.com/williamag929/BaseShiftWork/wiki
2. If the wiki doesn't exist yet, click "Create the first page"
3. If it exists, click "Edit" on any page or "New Page" to add pages

#### 2. Create Home Page

1. Click "Create the first page" or edit the existing Home page
2. Copy content from `WIKI_CONTENT_GUIDE.md` section "1. Home (Wiki Landing Page)"
3. Adapt the content as needed
4. Click "Save Page"

#### 3. Create Additional Pages

For each recommended page in the Wiki Content Guide:

1. Click "New Page" in the wiki
2. Enter the page title (e.g., "Quick Start", "Architecture", "API Reference")
3. Copy content from the corresponding section in `WIKI_CONTENT_GUIDE.md`
4. Adapt content from source files mentioned in the guide
5. Update internal links to use wiki format: `[Link Text](Page-Name)`
6. Click "Save Page"

#### 4. Create Sidebar Navigation

1. Create a new page named `_Sidebar`
2. Copy the sidebar structure from `WIKI_CONTENT_GUIDE.md` section "Sidebar Structure Example"
3. Customize as needed
4. Save the page

#### 5. Create Footer (Optional)

1. Create a new page named `_Footer`
2. Add copyright, version, and last updated information
3. Save the page

### Recommended Page Order

Create pages in this order for best workflow:

1. **Home** - Main landing page (source: README.md)
2. **Quick Start** - Get started guide (source: QUICK_START.md)
3. **Architecture** - System overview (source: README.md, AGENT.md)
4. **API Reference** - API endpoints (source: AGENT.md)
5. **Backend Development** - Backend setup (source: AGENT.md)
6. **Web Development** - Angular setup (source: ShiftWork.Angular/README.md)
7. **Mobile Development** - Mobile setup (source: ShiftWork.Mobile/README.md)
8. **Agent & MCP Guide** - Agent integration (source: AGENT.md, GITHUB_MCP_GUIDE.md)
9. **Features Guide** - Feature documentation (source: AGENT.md)
10. **Contributing** - Contribution guide (source: CONTRIBUTING.md)
11. **Security** - Security practices (source: AGENT.md)
12. **_Sidebar** - Navigation sidebar
13. **_Footer** - Page footer (optional)

## Wiki Link Format

When creating wiki pages, use these link formats:

- **Internal wiki links:** `[Page Title](Page-Name)` or `[[Page Name]]`
- **Links to repo files:** `[File](../blob/main/path/to/file.md)`
- **External links:** `[Link Text](https://example.com)`

## Tips for Success

### Content Adaptation

When copying content from source files:

1. **Remove repository-specific paths** - Wiki pages don't need full file paths
2. **Simplify code blocks** - Focus on essential examples
3. **Update links** - Change markdown links to wiki links
4. **Add context** - Wiki readers may not have full repository context
5. **Keep it current** - Reference the latest version of files

### Navigation Best Practices

1. **Create clear hierarchy** - Group related pages in sidebar
2. **Use descriptive titles** - Make page purpose obvious
3. **Cross-reference pages** - Link between related wiki pages
4. **Keep sidebar concise** - Don't list every page, just main sections

### Maintenance Strategy

1. **Regular updates** - Update wiki when documentation changes
2. **Version tracking** - Note last updated date on pages
3. **Link validation** - Periodically check all links work
4. **Feedback loop** - Encourage users to report outdated content

## Common Issues and Solutions

### Issue: Wiki doesn't exist yet

**Solution:** Click "Create the first page" when you first access the wiki URL.

### Issue: Can't edit wiki pages

**Solution:** Ensure you have write permissions on the repository. Contact a repository admin if needed.

### Issue: Images not displaying

**Solution:** Upload images to the wiki or reference them from the repository using full URLs:
```markdown
![Image](https://github.com/williamag929/BaseShiftWork/raw/main/path/to/image.png)
```

### Issue: Code blocks not rendering

**Solution:** Ensure you're using proper markdown code fences:
```markdown
```language
code here
```
```

### Issue: Links not working

**Solution:** Check link format. Wiki links should be `[Text](Page-Name)` not `[Text](page-name.md)`

## Verification Checklist

After creating the wiki, verify:

- [ ] Home page displays correctly with navigation links
- [ ] All main documentation pages are created
- [ ] Sidebar navigation works and links to all pages
- [ ] Internal wiki links work (no 404 errors)
- [ ] Code examples display correctly
- [ ] Images display (if any)
- [ ] Footer shows on all pages (if created)
- [ ] Content is readable and well-formatted
- [ ] No broken external links
- [ ] Last updated dates are current

## Maintenance Schedule

Suggested maintenance tasks:

### Weekly
- Check for new issues asking documentation questions
- Review recent PRs for documentation updates

### Monthly
- Validate all wiki links still work
- Update "Last Updated" dates on modified pages
- Review analytics to see most-viewed pages

### Quarterly
- Full content review and update
- Check for new features to document
- Verify all examples still work

## Alternative: Automated Sync (Future Enhancement)

For automated wiki updates in the future, consider:

1. **GitHub Actions workflow** - Sync markdown files to wiki automatically
2. **Wiki-as-Code** - Store wiki content in repo and deploy
3. **Documentation generators** - Use tools like MkDocs or Docusaurus
4. **API automation** - Use GitHub API to update wiki programmatically

See the "Wiki Automation" section in `WIKI_CONTENT_GUIDE.md` for more details.

## Need Help?

If you encounter issues updating the wiki:

1. **Check the guide** - Review `WIKI_CONTENT_GUIDE.md` for detailed content
2. **GitHub docs** - Visit https://docs.github.com/en/communities/documenting-your-project-with-wikis
3. **Create an issue** - Open a GitHub issue with label `documentation`
4. **Ask in discussions** - Use GitHub Discussions for questions

## Summary

This update provides:
- ✅ Enhanced Copilot instructions for AI agents
- ✅ Complete Wiki Content Guide with 14 recommended pages
- ✅ Documentation file mapping and source references
- ✅ Step-by-step wiki population instructions
- ✅ Sidebar navigation structure
- ✅ Maintenance guidelines

**Next Step:** Follow the instructions above to manually populate the GitHub Wiki using the content from `WIKI_CONTENT_GUIDE.md`.

---

**Document Version:** 1.0  
**Created:** February 17, 2026  
**Last Updated:** February 17, 2026
