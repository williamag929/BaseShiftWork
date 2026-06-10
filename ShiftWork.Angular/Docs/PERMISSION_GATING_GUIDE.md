# Angular Permission Gating Guide

## Overview
The permission gating system in ShiftWork Angular provides fine-grained UI control based on user roles and permissions. This guide explains how to use the new permission directives, pipes, and guards.

## Components

### 1. PermissionService
Central service for managing user permissions and roles.

**Key Methods:**
- `loadUserClaims(companyId)` - Load user claims from API
- `hasPermission(permission)` - Check single permission
- `hasAllPermissions(permissions[])` - Check all permissions required
- `hasAnyPermission(permissions[])` - Check if user has any of the permissions
- `getPermissions()` - Observable of user permissions
- `getRoles()` - Observable of user roles
- `clearClaims()` - Clear cached claims (on logout)

### 2. Permission Directives

#### HasPermissionDirective (`*appHasPermission`)
Show/hide elements when user has specific permission(s).

**Requires all permissions:**
```html
<button *appHasPermission="'people.delete'">Delete Person</button>

<div *appHasPermission="['people.read', 'people.update']">
  Edit Panel
</div>
```

#### HasAnyPermissionDirective (`*appHasAnyPermission`)
Show/hide elements when user has any of the permissions.

```html
<button *appHasAnyPermission="['people.create', 'people.admin']">
  New Person
</button>
```

### 3. Permission Pipes

#### HasPermissionPipe (`appHasPermission`)
Check permissions in expressions.

```html
<!-- Single permission -->
<div *ngIf="'people.create' | appHasPermission">
  User can create people
</div>

<!-- Multiple permissions (requires all) -->
<div *ngIf="['people.read', 'people.update'] | appHasPermission">
  User has full read/write access
</div>
```

#### HasAnyPermissionPipe (`appHasAnyPermission`)
Check if user has any of the permissions.

```html
<div *ngIf="['admin.read', 'people.admin'] | appHasAnyPermission">
  User is some kind of admin
</div>
```

### 4. Permission Guard (`PermissionGuard`)
Route guard to enforce permissions at navigation level.

**In routing module:**
```typescript
import { PermissionGuard } from '@core/guards/permission.guard';

const routes: Routes = [
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['admin.read'] }
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['company-settings.read', 'company-settings.update'] }
  }
];
```

## Setup Instructions

### 1. Load Permissions on Login
Update your login/auth flow to load permissions:

```typescript
// In auth.service or login component

async ngOnInit() {
  this.auth.user$.subscribe(user => {
    if (user && this.auth.activeCompany) {
      // Load user permissions for the company
      this.auth.loadUserPermissions(this.auth.activeCompany.companyId)
        .subscribe(
          claims => console.log('Permissions loaded', claims),
          error => console.error('Failed to load permissions', error)
        );
    }
  });
}
```

### 2. Load Permissions on Company Switch
When user switches companies, reload permissions:

```typescript
// In company-switch component

switchCompany(companyId: string) {
  // Switch logic...
  
  // Reload permissions for new company
  this.auth.loadUserPermissions(companyId).subscribe(
    claims => console.log('Permissions updated for company', companyId),
    error => console.error('Failed to update permissions', error)
  );
}
```

### 3. Import Directives/Pipes in Components
For standalone components, import directives and pipes:

```typescript
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { HasAnyPermissionDirective } from '@core/directives/has-any-permission.directive';
import { HasPermissionPipe } from '@core/pipes/has-permission.pipe';
import { HasAnyPermissionPipe } from '@core/pipes/has-any-permission.pipe';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [
    CommonModule,
    HasPermissionDirective,
    HasAnyPermissionDirective,
    HasPermissionPipe,
    HasAnyPermissionPipe
  ]
})
export class PeopleComponent {}
```

## Permission Keys Reference

Common permission keys used throughout the application:

```
People:
  - people.read
  - people.create
  - people.update
  - people.delete

Locations:
  - locations.read
  - locations.create
  - locations.update
  - locations.delete

Schedules:
  - schedules.read
  - schedules.create
  - schedules.update
  - schedules.delete

Admin:
  - roles.read
  - roles.create
  - roles.update
  - roles.delete
  - permissions.read
  - company-users.read
  - company-users.update
  - company-users.roles.update
  - company-settings.update

Kiosk:
  - kiosk.admin
```

## Examples

### Example 1: Conditional Button Display
```html
<div class="action-bar">
  <!-- Show delete button only if user has delete permission -->
  <button *appHasPermission="'people.delete'" (click)="deletePerson()">
    Delete
  </button>

  <!-- Show edit button if user can read and update -->
  <button *appHasPermission="['people.read', 'people.update']" (click)="editPerson()">
    Edit
  </button>

  <!-- Show admin section if user is admin or manager -->
  <section *appHasAnyPermission="['admin.all', 'people.admin']">
    <h3>Admin Tools</h3>
  </section>
</div>
```

### Example 2: Disable Controls Based on Permissions
```typescript
export class PeopleComponent {
  canDelete$: Observable<boolean>;
  canEdit$: Observable<boolean>;

  constructor(private permission: PermissionService) {
    this.canDelete$ = this.permission.permissions$.pipe(
      map(claims => claims?.permissions.includes('people.delete') ?? false)
    );

    this.canEdit$ = this.permission.permissions$.pipe(
      map(claims => claims?.permissions.includes('people.update') ?? false)
    );
  }

  deletePerson(id: number) {
    if (this.permission.hasPermission('people.delete')) {
      // Proceed with deletion
    }
  }
}
```

### Example 3: Route Protection
```typescript
const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path: 'admin/roles',
    component: RolesManagementComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['roles.read', 'roles.update'] }
  },
  {
    path: 'admin/users',
    component: UsersManagementComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['company-users.read'] }
  }
];
```

## Cache Invalidation

The `permissionsVersion` field in the user claims is used to detect when permissions have changed:

```typescript
loadUserClaims(companyId: string) {
  const current = this.permissionsSubject.value;
  
  if (current && needsRefresh()) {
    // Force reload if version changed
    return this.loadUserClaims(companyId);
  }
}

private needsRefresh(): boolean {
  // Check against server version or local cache
  return true; // Or determine based on your invalidation strategy
}
```

## Best Practices

1. **Always use server-side enforcement** - Never rely solely on UI-level permission checks. Always validate permissions on the API side.

2. **Load permissions early** - Load permissions immediately after user login to minimize UI inconsistencies.

3. **Use directives for large sections** - Use `*appHasPermission` for large conditional blocks (more efficient than pipes).

4. **Use pipes for simple checks** - Use pipes for inline permission checks in expressions.

5. **Refresh on company switch** - Always reload permissions when user switches companies.

6. **Handle missing permissions gracefully** - Show appropriate messages instead of just hiding features.

```html
<div *appHasPermission="'people.delete'; else noPermission">
  <button (click)="delete()">Delete</button>
</div>

<ng-template #noPermission>
  <p class="text-muted">You don't have permission to delete records.</p>
</ng-template>
```

## Testing

```typescript
describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PermissionService, HttpClientTestingModule]
    });
    service = TestBed.inject(PermissionService);
  });

  it('should check single permission', () => {
    service['permissionsSubject'].next({
      companyId: '123',
      userId: 'user1',
      roles: ['Admin'],
      permissions: ['people.read', 'people.write'],
      permissionsVersion: 1
    });

    expect(service.hasPermission('people.read')).toBeTrue();
    expect(service.hasPermission('people.delete')).toBeFalse();
  });

  it('should check all permissions', () => {
    service['permissionsSubject'].next({
      companyId: '123',
      userId: 'user1',
      roles: ['Admin'],
      permissions: ['people.read', 'people.write'],
      permissionsVersion: 1
    });

    expect(service.hasAllPermissions(['people.read', 'people.write'])).toBeTrue();
    expect(service.hasAllPermissions(['people.read', 'people.delete'])).toBeFalse();
  });
});
```

## Troubleshooting

**Permissions not loading:**
- Ensure `/api/companies/{companyId}/users/me/claims` endpoint is reachable
- Check that user is authenticated with valid Firebase token
- Verify company ID is correct

**Directives not hiding elements:**
- Ensure directives are imported in component
- Check permission keys match exactly (case-sensitive)
- Verify permissions loaded via `PermissionService` before template renders

**Route guard not working:**
- Ensure `PermissionGuard` is in route `canActivate`
- Check `data: { permissions: [...] }` is set correctly
- Verify permissions are loaded before navigation attempt
