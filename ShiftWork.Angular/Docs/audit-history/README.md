# Audit History UI Components

This directory contains all the Angular components and services for the audit history feature in ShiftWork.

## Components

### `audit-history-dialog.component.ts`
Main dialog component that displays detailed audit history for any entity (Person, Schedule, Location, etc.).

**Features:**
- Entity-specific change history with pagination
- Filter by action type and date range
- Related entities tab (shows shifts/schedules for employees)
- Summary tab with statistics and field-level changes
- Support for multi-tenant isolation (company-scoped)

**Usage:**
```typescript
const dialogData: AuditHistoryDialogData = {
  entityName: 'Person',
  entityId: '12345',
  entityDisplayName: 'John Smith',
  companyId: 'company-id'
};

this.dialog.open(AuditHistoryDialogComponent, {
  data: dialogData,
  width: '95vw',
  maxWidth: '1000px',
  maxHeight: '90vh'
});
```

### `audit-history-timeline.component.ts`
Displays audit records in a chronological timeline format with visual indicators for action types.

**Features:**
- Color-coded action type indicators (Created: green, Updated: blue, Deleted: red)
- Relative time display (e.g., "2h ago")
- Field-level change display with old/new values
- Responsive design for mobile and desktop
- Truncated value display for long strings

### `audit-history-filters.component.ts`
Reusable filter component for audit history records.

**Features:**
- Filter by action type (Created, Updated, Deleted)
- Filter by entity type (Person, Schedule, Location, etc.)
- Date range selection (from/to)
- Default to last 30 days
- Reset filters functionality

**Usage:**
```typescript
<app-audit-history-filters
  [showEntityTypeFilter]="true"
  (filtersApplied)="onFiltersApplied($event)"
></app-audit-history-filters>

onFiltersApplied(filters: AuditFilterParams): void {
  // Handle filter changes
}
```

### `audit-history-button.component.ts`
Small button component that opens the audit history dialog for any entity.

**Features:**
- Icon button with tooltip
- Configurable entity type and display name
- Material icon integration

**Usage:**
```html
<app-audit-history-button
  [entity]="employee"
  entityType="Person"
  [entityId]="employee.personId"
  [entityDisplayName]="employee.name"
  [companyId]="activeCompanyId"
></app-audit-history-button>
```

## Models

### `audit-history.model.ts`
TypeScript interfaces and enums for type-safe audit history handling.

**Interfaces:**
- `AuditHistoryDto`: Single audit record
- `AuditHistoryPagedResult`: Paginated results
- `AuditSummaryDto`: Summary statistics
- `AuditHistoryParams`: Query parameters

**Enums:**
- `AuditActionType`: Created, Updated, Deleted
- `AuditEntityType`: Person, Schedule, Location, ShiftEvent, etc.

## Service

### `audit-history.service.ts`
HTTP service for fetching audit history data from the API.

**Methods:**
- `getAuditHistoryForEntity(params)`: Get audit history for a specific entity
- `getRelatedAuditHistory(companyId, entityName, entityId)`: Get history for related entities
- `getAuditSummary(companyId, startDate?, endDate?)`: Get summary statistics
- `getFieldHistory(...)`: Get changes for a specific field

**Example:**
```typescript
constructor(private auditService: AuditHistoryService) {}

loadHistory(): void {
  this.auditService.getAuditHistoryForEntity({
    companyId: 'company-123',
    entityName: 'Person',
    entityId: '456',
    page: 1,
    pageSize: 20
  }).subscribe(result => {
    console.log(result.items);
  });
}
```

## Integration with Employee List

To add the History button to the employee list:

1. Import the button component in the employee list module
2. Add the button to the employee card action buttons
3. Pass the employee entity and company ID

**Example HTML:**
```html
<app-audit-history-button
  [entity]="employee"
  entityType="Person"
  [entityId]="employee.personId"
  [entityDisplayName]="employee.name"
  [companyId]="activeCompanyId"
></app-audit-history-button>
```

## Material Design Dependencies

The components use Angular Material:
- `@angular/material/dialog` - Modal dialogs
- `@angular/material/button` - Buttons
- `@angular/material/icon` - Icons
- `@angular/material/tabs` - Tabbed interface
- `@angular/material/paginator` - Pagination
- `@angular/material/form-field` - Form fields
- `@angular/material/select` - Select dropdowns
- `@angular/material/datepicker` - Date picker
- `@angular/material/core` - Core components

## Styling

All components are styled with:
- **Responsive design**: Works on mobile (320px) to desktop (1920px+)
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation
- **Color coding**: Action types use standard colors (green for create, blue for update, red for delete)
- **Dark/Light theme**: Compatible with both light and dark themes

## API Integration

The components expect the following API endpoints:

```
GET /api/companies/{companyId}/audit-history/{entityName}/{entityId}
  Query params: page, pageSize, actionType, startDate, endDate

GET /api/companies/{companyId}/audit-history/{entityName}/{entityId}/related
  Query params: startDate, pageSize

GET /api/companies/{companyId}/audit-history/summary
  Query params: startDate, endDate
```

See [AGENT.md](../AGENT.md) for complete API documentation.

## Testing

Each component can be tested independently:

```typescript
// Mock audit history data
const mockAuditHistory: AuditHistoryDto[] = [
  {
    id: '1',
    entityName: 'Person',
    entityId: '123',
    actionType: 'Updated',
    actionDate: new Date(),
    userId: 'user-123',
    userName: 'John Doe',
    fieldName: 'PhoneNumber',
    oldValue: '(555) 123-4567',
    newValue: '(555) 987-6543'
  }
];

// Test timeline component
TestBed.configureTestingModule({
  imports: [AuditHistoryTimelineComponent]
});
const fixture = TestBed.createComponent(AuditHistoryTimelineComponent);
fixture.componentInstance.items = mockAuditHistory;
fixture.detectChanges();
```

## Future Enhancements

1. **Export functionality**: Download audit logs as CSV/PDF
2. **Advanced search**: Full-text search across audit records
3. **Audit log comparison**: Show diffs between versions
4. **Automated alerts**: Notify on specific types of changes
5. **Rollback functionality**: Restore previous values
6. **Retention policies**: Automatic archival/cleanup of old audit logs

## See Also

- [FEATURE_AUDIT_HISTORY.md](../../FEATURE_AUDIT_HISTORY.md) - Feature documentation
- [AGENT.md](../../AGENT.md) - API reference and architecture
- [ShiftWork.Angular/README.md](../README.md) - Angular project setup
