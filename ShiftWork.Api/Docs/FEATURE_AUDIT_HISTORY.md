# Feature Documentation: Audit History From Record Screens

## Overview
The Audit History feature provides comprehensive tracking of all changes to entities within the ShiftWork application. This feature allows users to view a complete history of modifications made to any record, including who made the change, when it was made, and what values were changed.

## Goals
1. **Transparency**: Provide complete visibility into all changes made to records
2. **Accountability**: Track who made each change and when
3. **Compliance**: Meet audit requirements for tracking data modifications
4. **Debugging**: Help identify when and how data issues were introduced
5. **User Experience**: Accessible audit history from any record detail screen

## Architecture

### Data Model
The audit system will use a dedicated `AuditHistory` table to store change records:

```
AuditHistory
- Id (Guid, Primary Key)
- CompanyId (string, Multi-tenant isolation)
- EntityName (string, e.g., "Person", "Schedule", "Location")
- EntityId (string, The ID of the modified entity)
- ActionType (string, "Created", "Updated", "Deleted")
- ActionDate (DateTime, When the change occurred)
- UserId (string, Who made the change)
- UserName (string, Denormalized for display)
- FieldName (string, nullable, specific field that changed)
- OldValue (string, nullable, JSON or text representation)
- NewValue (string, nullable, JSON or text representation)
- ChangeDescription (string, Human-readable change summary)
- Metadata (string, nullable, Additional JSON data)
```

### API Endpoints

#### Get Audit History for an Entity
```
GET /api/companies/{companyId}/audit-history/{entityName}/{entityId}
Query Parameters:
  - page (int, default: 1)
  - pageSize (int, default: 50, max: 100)
  - actionType (string, optional filter)
  - startDate (DateTime, optional)
  - endDate (DateTime, optional)
  
Response: PagedResult<HistoricActionDto>
```

#### Get Audit History Summary
```
GET /api/companies/{companyId}/audit-history/summary
Query Parameters:
  - entityName (string, optional)
  - startDate (DateTime, default: last 30 days)
  - endDate (DateTime, default: now)
  
Response: List<AuditSummaryDto>
```

### DTOs

#### HistoricActionDto (Already exists)
```csharp
public class HistoricActionDto
{
    public Guid Id { get; set; }
    public DateTime ActionDate { get; set; }
    public string ActionType { get; set; }
    public string Description { get; set; }
    public string? Metadata { get; set; }
}
```

#### Extended for Audit History
```csharp
public class AuditHistoryDto : HistoricActionDto
{
    public string EntityName { get; set; }
    public string EntityId { get; set; }
    public string UserId { get; set; }
    public string UserName { get; set; }
    public string? FieldName { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
}
```

#### AuditSummaryDto
```csharp
public class AuditSummaryDto
{
    public string EntityName { get; set; }
    public int TotalChanges { get; set; }
    public DateTime LastModified { get; set; }
    public string LastModifiedBy { get; set; }
}
```

## Implementation Details

### 1. Extend Audit Interceptor
The existing `AuditInterceptor.cs` will be extended to:
- Capture full change history (not just last update metadata)
- Store detailed field-level changes
- Support all entity types (not just Person, ScheduleShift, TaskShift)
- Write records to the `AuditHistory` table

### 2. Supported Entities
All entities extending `BaseEntity` will be automatically tracked:
- Person (Employees)
- Location
- Schedule & ScheduleShift
- Task & TaskShift
- Department
- Position
- ShiftEvent
- Note
- Notification
- And all other entities

### 3. Change Tracking Strategy
- **Create**: Log entity creation with all initial values
- **Update**: Log field-by-field changes with old and new values
- **Delete**: Log deletion with snapshot of final state
- **Field-Level**: Each field change creates a separate audit record for granular history

### 4. Performance Considerations
- Asynchronous audit logging to avoid blocking main operations
- Indexed queries by CompanyId, EntityName, EntityId, and ActionDate
- Configurable retention policy (default: 2 years)
- Optional audit log archival/cleanup service

### 5. Security & Privacy
- Audit logs are company-isolated (via CompanyId)
- Sensitive fields (passwords, tokens) are excluded from audit logs
- Audit history requires appropriate permissions (e.g., admin or manager role)
- PII handling compliant with retention policies

## User Interface

### Record Detail Screens
Each record detail screen (Person, Location, Schedule, etc.) will include:
- **Audit History Tab/Section**: Displays chronological list of changes
- **Timeline View**: Visual representation of changes over time
- **Change Details**: Expandable view showing old vs. new values
- **Filter Options**: By date range, action type, user

### Display Format
```
[ActionType Icon] [ActionDate] by [UserName]
  [FieldName]: [OldValue] → [NewValue]
  [FieldName]: [OldValue] → [NewValue]
  ...
```

Example:
```
✏️ Updated on 2024-02-15 10:30 AM by John Smith
  FirstName: "John" → "Jonathan"
  Phone: "(555) 123-4567" → "(555) 987-6543"
```

## Angular Implementation

### Components
- `AuditHistoryComponent`: Reusable component for displaying audit logs
- `AuditTimelineComponent`: Visual timeline representation
- `AuditDetailDialogComponent`: Detailed change view

### Services
- `AuditHistoryService`: API integration for fetching audit logs

### Integration Points
Add audit history section to:
- Person detail page
- Location detail page
- Schedule detail page
- Department detail page
- Position detail page
- Task detail page

## Mobile Implementation

### Screens
- Audit History List Screen (readonly view)
- Audit Detail Screen (view change details)

### Features
- Pull-to-refresh for latest changes
- Filter by date range
- Search by user

## Testing Requirements

### Unit Tests
- AuditInterceptor logic for all action types
- AuditHistoryService methods
- DTO mapping

### Integration Tests
- Full CRUD cycle with audit logging
- Multi-tenant isolation
- Query filtering and pagination

### UI Tests
- Audit history component rendering
- Timeline visualization
- Detail expansion

## Success Metrics
1. 100% of entity changes are captured in audit logs
2. Audit history accessible from all record screens
3. Query performance < 500ms for typical audit history requests
4. Zero audit logging failures (should not block main operations)

## Future Enhancements
1. Audit log export (CSV, PDF)
2. Advanced filtering and search
3. Audit log comparison (diff view)
4. Automated alerts for specific changes
5. Audit log retention policies and archival
6. Rollback functionality (restore previous values)

## Dependencies
- Entity Framework Core (already in use)
- System.Text.Json (for metadata serialization)
- Existing authentication/authorization system

## Migration Path
1. Create AuditHistory table via EF migration
2. Deploy updated AuditInterceptor
3. No data migration needed (starts tracking from deployment)
4. UI components deployed progressively per screen

## Rollback Plan
If issues arise:
1. Disable audit logging via configuration flag
2. Remove AuditHistory endpoints from API
3. Hide UI components
4. AuditHistory table can remain for data retention
