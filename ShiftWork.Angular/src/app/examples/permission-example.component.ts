/**
 * Example: Using Permission Gating in PeopleComponent
 *
 * This shows how to integrate PermissionService, directives, and pipes
 * into your Angular component for permission-based UI gating.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { PermissionService } from '@core/services/permission.service';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { HasAnyPermissionDirective } from '@core/directives/has-any-permission.directive';
import { HasPermissionPipe } from '@core/pipes/has-permission.pipe';
import { HasAnyPermissionPipe } from '@core/pipes/has-any-permission.pipe';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-people-example',
  standalone: true,
  imports: [
    CommonModule,
    HasPermissionDirective,
    HasAnyPermissionDirective,
    HasPermissionPipe,
    HasAnyPermissionPipe
  ],
  template: `
    <div class="people-container">
      <h1>People Management</h1>

      <!-- Action Bar with Permission-Gated Buttons -->
      <div class="action-bar" *appHasPermission="'people.read'">
        
        <!-- Create Button -->
        <button 
          *appHasPermission="'people.create'"
          (click)="onCreatePerson()"
          class="btn btn-primary">
          Add Person
        </button>

        <!-- Delete Button (single permission) -->
        <button 
          *appHasPermission="'people.delete'"
          (click)="onDeleteSelected()"
          class="btn btn-danger"
          [disabled]="!hasSelected">
          Delete Selected
        </button>

        <!-- Bulk Actions (admin only) -->
        <div *appHasAnyPermission="['people.admin', 'admin.all']" class="bulk-actions">
          <button (click)="onBulkUpdate()" class="btn btn-secondary">
            Bulk Update Roles
          </button>
        </div>
      </div>

      <!-- People Table -->
      <table class="table" *appHasPermission="'people.read'">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <!-- Actions column only if user can perform any action -->
            <th *appHasAnyPermission="['people.update', 'people.delete']">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let person of people">
            <td>{{ person.name }}</td>
            <td>{{ person.email }}</td>
            <td>{{ person.role }}</td>
            <td *appHasAnyPermission="['people.update', 'people.delete']">
              
              <!-- Edit Button -->
              <button 
                *appHasPermission="'people.update'"
                (click)="onEditPerson(person)"
                class="btn btn-sm btn-info">
                Edit
              </button>

              <!-- Delete Button -->
              <button 
                *appHasPermission="'people.delete'"
                (click)="onDeletePerson(person)"
                class="btn btn-sm btn-danger">
                Delete
              </button>

            </td>
          </tr>
        </tbody>
      </table>

      <!-- No Permission Message -->
      <div *ngIf="!(canRead$ | async)" class="alert alert-info">
        You don't have permission to view people records.
      </div>

      <!-- Settings (using pipe syntax) -->
      <section *ngIf="'company-settings.update' | appHasPermission" class="settings">
        <h3>Settings</h3>
        <button (click)="onOpenSettings()" class="btn btn-secondary">
          Configure
        </button>
      </section>
    </div>
  `,
  styles: [`
    .action-bar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }
    .table {
      width: 100%;
    }
    .bulk-actions {
      margin-left: auto;
    }
  `]
})
export class PeopleExampleComponent implements OnInit, OnDestroy {
  people: any[] = [];
  hasSelected = false;
  canRead$: Observable<boolean>;

  private destroy$ = new Subject<void>();

  constructor(
    private permissionService: PermissionService,
    private authService: AuthService
  ) {
    this.canRead$ = this.permissionService.permissions$.pipe(
      takeUntil(this.destroy$)
    ).pipe(
      map(claims => claims?.permissions.includes('people.read') ?? false)
    );
  }

  ngOnInit(): void {
    // Load people if user has read permission
    if (this.permissionService.hasPermission('people.read')) {
      this.loadPeople();
    }

    // Subscribe to permission changes
    this.permissionService.permissions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(claims => {
        // Re-load data or update UI if permissions change
        if (claims?.permissions.includes('people.read')) {
          this.loadPeople();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCreatePerson(): void {
    // Validate permission before action
    if (!this.permissionService.hasPermission('people.create')) {
      console.warn('User lacks people.create permission');
      return;
    }
    // Open create dialog...
  }

  onEditPerson(person: any): void {
    if (!this.permissionService.hasPermission('people.update')) {
      console.warn('User lacks people.update permission');
      return;
    }
    // Open edit dialog...
  }

  onDeletePerson(person: any): void {
    if (!this.permissionService.hasPermission('people.delete')) {
      console.warn('User lacks people.delete permission');
      return;
    }
    // Perform delete...
  }

  onDeleteSelected(): void {
    if (!this.permissionService.hasPermission('people.delete')) {
      console.warn('User lacks people.delete permission');
      return;
    }
    // Perform bulk delete...
  }

  onBulkUpdate(): void {
    // Check if user has admin permissions
    if (!this.permissionService.hasAnyPermission(['people.admin', 'admin.all'])) {
      console.warn('User lacks admin permissions');
      return;
    }
    // Perform bulk update...
  }

  onOpenSettings(): void {
    if (!this.permissionService.hasPermission('company-settings.update')) {
      console.warn('User lacks company-settings.update permission');
      return;
    }
    // Open settings...
  }

  private loadPeople(): void {
    // Implement people loading logic
    // this.peopleService.getPeople().subscribe(...)
  }
}

/**
 * Key Takeaways:
 *
 * 1. Use directives (*appHasPermission) for UI structure
 * 2. Use pipes (| appHasPermission) for simple expressions
 * 3. Always validate permissions in component methods before action
 * 4. Subscribe to permission changes to react to updates
 * 5. Server-side validation is ALWAYS required for security
 * 6. Never completely hide critical functionality without clear messaging
 */
