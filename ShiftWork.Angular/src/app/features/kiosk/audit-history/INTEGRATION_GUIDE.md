# Audit History Integration Guide

This guide explains how to integrate the Audit History feature into your existing Angular components.

## Step 1: Update Module Imports

Update your module to import the audit history components. For example, in `kiosk.module.ts` or `employee-list.module.ts`:

```typescript
import { AuditHistoryDialogComponent } from './audit-history/audit-history-dialog.component';
import { AuditHistoryButtonComponent } from './audit-history/audit-history-button.component';
import { AuditHistoryTimelineComponent } from './audit-history/audit-history-timeline.component';
import { AuditHistoryFiltersComponent } from './audit-history/audit-history-filters.component';

@NgModule({
  // ... other module configuration
  imports: [
    // ... existing imports
    AuditHistoryDialogComponent,
    AuditHistoryButtonComponent,
    AuditHistoryTimelineComponent,
    AuditHistoryFiltersComponent,
    MatDialogModule  // MaterialDialog is required
  ]
})
export class YourModule { }
```

OR (if using standalone components):

```typescript
// In your component's imports array:
imports: [
  AuditHistoryButtonComponent,
  // ... other imports
]
```

## Step 2: Add History Button to Employee List

In your `employee-list.component.html`, add the audit history button to the action buttons area:

```html
<div class="action-buttons mt-2">
  <!-- Existing buttons -->
  <div class="btn btn-sm btn-outline-success me-2" *ngIf="canStartShift(employee)">
    <i class="bi bi-play-circle"></i> Start
  </div>
  
  <!-- NEW: Add this audit history button -->
  <app-audit-history-button
    [entity]="employee"
    entityType="Person"
    [entityId]="employee.personId"
    [entityDisplayName]="employee.name"
    [companyId]="activeCompany?.companyId || ''"
  ></app-audit-history-button>
</div>
```

**Required properties:**
- `entity` - The entity object (e.g., employee, schedule, location)
- `entityType` - String identifier for entity type ('Person', 'Schedule', 'Location', etc.)
- `entityId` - Unique identifier for the entity (ID or string ID)
- `entityDisplayName` - Human-readable name to display in audit dialog title
- `companyId` - Company ID for multi-tenant isolation

## Step 3: Ensure Material Dialog Module is Imported

The audit history dialog uses Angular Material. Make sure your app module includes:

```typescript
import { MatDialogModule } from '@angular/material/dialog';

@NgModule({
  imports: [
    MatDialogModule,
    // ... other imports
  ]
})
export class AppModule { }
```

## Step 4: Add Audit History to Other Screens

### For Schedule Details Screen

```typescript
// In your schedule detail component
@Component(...)
export class ScheduleDetailComponent {
  schedule: Schedule;
  activeCompanyId: string;
  
  // In your template:
  // <app-audit-history-button
  //   [entity]="schedule"
  //   entityType="Schedule"
  //   [entityId]="schedule.scheduleId"
  //   [entityDisplayName]="schedule.name"
  //   [companyId]="activeCompanyId"
  // ></app-audit-history-button>
}
```

### For Location Details Screen

```typescript
// Similar pattern for Location
<app-audit-history-button
  [entity]="location"
  entityType="Location"
  [entityId]="location.locationId"
  [entityDisplayName]="location.name"
  [companyId]="activeCompanyId"
></app-audit-history-button>
```

### For Department Details Screen

```typescript
<app-audit-history-button
  [entity]="department"
  entityType="Department"
  [entityId]="department.departmentId"
  [entityDisplayName]="department.name"
  [companyId]="activeCompanyId"
></app-audit-history-button>
```

## Step 5: Programmatically Open Audit History

If you want to open the audit history dialog programmatically (without the button):

```typescript
import { MatDialog } from '@angular/material/dialog';
import { AuditHistoryDialogComponent, AuditHistoryDialogData } from './audit-history/audit-history-dialog.component';

export class MyComponent {
  constructor(private dialog: MatDialog) {}
  
  openAuditHistory(entity: any, entityType: string): void {
    const dialogData: AuditHistoryDialogData = {
      entityName: entityType,
      entityId: entity.id.toString(),
      entityDisplayName: entity.name,
      companyId: this.activeCompanyId
    };

    this.dialog.open(AuditHistoryDialogComponent, {
      data: dialogData,
      width: '95vw',
      maxWidth: '1000px',
      maxHeight: '90vh',
      panelClass: 'audit-history-dialog-panel'
    });
  }
}
```

## Step 6: Customize Styling (Optional)

Add custom CSS to `styles.scss` or your component's SCSS:

```scss
// Custom styling for audit history dialog
::ng-deep {
  .audit-history-dialog-panel {
    // Add custom panel styles
  }
  
  .audit-history-dialog {
    // Add custom dialog content styles
  }
}
```

## Complete Example: Updated Employee List Module

```typescript
// employee-list.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeListRoutingModule } from './employee-list-routing.module';
import { SharedModule } from '../../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';

// Import audit history components
import { AuditHistoryButtonComponent } from '../audit-history/audit-history-button.component';
import { AuditHistoryDialogComponent } from '../audit-history/audit-history-dialog.component';
import { AuditHistoryTimelineComponent } from '../audit-history/audit-history-timeline.component';
import { AuditHistoryFiltersComponent } from '../audit-history/audit-history-filters.component';

@NgModule({
  declarations: [
    // ... existing declarations
  ],
  imports: [
    CommonModule,
    SharedModule,
    EmployeeListRoutingModule,
    ReactiveFormsModule,
    MatDialogModule,
    
    // Add audit history components (standalone)
    AuditHistoryButtonComponent,
    AuditHistoryDialogComponent,
    AuditHistoryTimelineComponent,
    AuditHistoryFiltersComponent
  ]
})
export class EmployeeListModule { }
```

## Complete Example: Updated Employee List HTML

```html
<!-- employee-list.component.html -->
<div class="toolbar">
  <div class="search-container">
    <input type="text" [formControl]="searchControl" placeholder="Search employees...">
  </div>
  <!-- ... existing toolbar content ... -->
</div>

<div class="employee-grid">
  <div *ngFor="let employee of filteredEmployees" class="employee-card">
    <div class="initials-circle">
      <span class="initials">{{ getInitials(employee.name) }}</span>
    </div>
    
    <div class="employee-name">
      {{ employee.name }}
    </div>
    
    <!-- Action buttons with History -->
    <div class="action-buttons mt-2">
      <button 
        class="btn btn-sm btn-outline-success me-2" 
        *ngIf="canStartShift(employee)"
        (click)="startShift(employee)"
      >
        <i class="bi bi-play-circle"></i> Start
      </button>
      
      <button 
        class="btn btn-sm btn-outline-danger me-2" 
        *ngIf="canEndShift(employee)"
        (click)="endShift(employee)"
      >
        <i class="bi bi-stop-circle"></i> End
      </button>
      
      <!-- History Button -->
      <app-audit-history-button
        [entity]="employee"
        entityType="Person"
        [entityId]="employee.personId"
        [entityDisplayName]="employee.name"
        [companyId]="activeCompany?.companyId || ''"
      ></app-audit-history-button>
    </div>
  </div>
</div>
```

## API Requirements

Make sure your API is configured with the following endpoints:

```
GET /api/companies/{companyId}/audit-history/{entityName}/{entityId}
GET /api/companies/{companyId}/audit-history/{entityName}/{entityId}/related
GET /api/companies/{companyId}/audit-history/summary
```

See [AGENT.md](../../AGENT.md) for complete API documentation.

## Environment Configuration

Ensure your `environment.ts` has the correct `apiBaseUrl`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000'  // Adjust to your API URL
};
```

## Troubleshooting

### 1. Dialog not opening
- Check that `MatDialogModule` is imported
- Verify `AuditHistoryDialogComponent` is imported in your module
- Check browser console for errors

### 2. Button not showing
- Verify `AuditHistoryButtonComponent` is imported
- Check that required `@Input` properties are provided
- Inspect element to see if HTML is rendered

### 3. API errors
- Verify API endpoints are implemented
- Check network tab in browser DevTools
- Ensure `companyId` is correct and passed properly
- Verify authentication tokens are valid

### 4. Styling issues
- Check that Angular Material CSS is loaded
- Clear browser cache and rebuild
- Check for CSS conflicts with global styles

## Next Steps

1. **Test the integration**: Open an employee card and click the History button
2. **Verify API calls**: Check browser network tab to ensure API calls are working
3. **Add to other screens**: Repeat the same pattern for Schedule, Location, Department, etc.
4. **Configure retention policy**: Set up automatic cleanup of old audit logs (if needed)
5. **Add permissions**: Implement role-based access control for audit history access

## See Also

- [README.md](./README.md) - Component documentation
- [INTEGRATION_EXAMPLE.html](./INTEGRATION_EXAMPLE.html) - HTML example
- [FEATURE_AUDIT_HISTORY.md](../../FEATURE_AUDIT_HISTORY.md) - Feature documentation
