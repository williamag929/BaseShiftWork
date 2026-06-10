# MCP Future Features / Ideas

## Recommended uses for unpublished-schedules endpoint

### Endpoint + service mapping
- **API endpoint:** `GET /api/companies/{companyId}/people/unpublished-schedules?startDate=&endDate=` in PeopleController.
- **Service:** `IPeopleService.GetPeopleWithUnpublishedSchedules(...)` in PeopleService.
- **MCP tool:** `get_people_with_unpublished_schedules` in python_client/http_mcp_server.py.

### 1) Daily “publish backlog” report
- **Goal:** List people who still have unpublished schedules for today.
- **Call:** MCP tool `get_people_with_unpublished_schedules` with `start_date`/`end_date` set to today.
- **Output:** Person name + `unpublishedScheduleCount` + schedule IDs.
- **Implementation notes:**
	- Use local day boundaries in company time zone when setting dates.
	- Cache results for 5–10 minutes to avoid repeated API calls during dashboards.

### 2) Manager digest (7-day window)
- **Goal:** Summarize upcoming unpublished schedules grouped by person.
- **Call:** `start_date` = today, `end_date` = today + 7 days.
- **Output:** Grouped list with counts; optionally include date range in message.
- **Implementation notes:**
	- Add a summary line: total people + total unpublished schedules.
	- Use a scheduled job or cron to run daily.

### 3) Escalation reminders for high counts
- **Goal:** Alert when a person has >N unpublished schedules.
- **Call:** Same as manager digest, then filter client-side by count.
- **Output:** List of people exceeding threshold.
- **Implementation notes:**
	- Make threshold configurable (e.g., 3 or 5).
	- Integrate with Notification Service (push/SMS/email) if available.

### 4) Location-specific staffing checks
- **Goal:** Compare unpublished schedules vs expected coverage.
- **Call:** Use date range; apply location filtering server-side if added later.
- **Output:** People list + schedule IDs; correlate to location in schedule details.
- **Implementation notes:**
	- Consider extending endpoint to accept `locationId` for server-side filtering.
	- If not extended, pull schedules separately and filter by location.

### 5) Pre-kiosk validation
- **Goal:** Ensure employees have published schedules before clock-in window.
- **Call:** Date range set to today; cross-check kiosk location/area.
- **Output:** Block or warn if person is on unpublished schedule.
- **Implementation notes:**
	- Use this as a soft warning; do not block clock-in unless required by policy.
	- Combine with PIN verification flow when needed.

### 6) Admin cleanup tool (stale drafts)
- **Goal:** Identify unpublished schedules older than X days.
- **Call:** `end_date` = today - X days.
- **Output:** People list with counts, optionally show oldest schedule.
- **Implementation notes:**
	- Add optional `minCreatedAt`/`maxCreatedAt` filters if needed.
	- Consider a bulk “publish all for person” action in admin UI.

### 7) Scheduling assistant workflow
- **Goal:** Provide AI suggestions for publishing.
- **Call:** 7–14 day window.
- **Output:** Ranked list (e.g., highest count first).
- **Implementation notes:**
	- Include human-readable summary for each person.
	- Keep MCP response small; paginate if the list is large.

### 8) QA/test automation
- **Goal:** Validate that publish operations clear unpublished counts.
- **Call:** Before/after publishing schedules.
- **Output:** Expect count decrease to zero for target persons.
- **Implementation notes:**
	- Use deterministic test data (fixed companyId, known schedules).
	- Fail tests if counts remain unchanged after publish.

### 9) Audit preparation
- **Goal:** Export list before payroll cutoff.
- **Call:** Date range covering pay period.
- **Output:** CSV-friendly list (person, count, schedule IDs).
- **Implementation notes:**
	- Add an export endpoint or client-side CSV transform.
	- Store a snapshot artifact for audit trails.

### 10) AI agent triage
- **Goal:** Auto-suggest which supervisors to notify.
- **Call:** 7-day window.
- **Output:** People list with counts; map to supervisor logic in client.
- **Implementation notes:**
	- Extend data model later to include supervisor mapping.
	- Use Notification Service channels for delivery.
