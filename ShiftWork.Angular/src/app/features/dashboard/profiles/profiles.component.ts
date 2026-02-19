import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { Role } from 'src/app/core/models/role.model';
import { RoleService } from 'src/app/core/services/role.service';
import { ToastrService } from 'ngx-toastr';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { PeopleService } from 'src/app/core/services/people.service';
import { People } from 'src/app/core/models/people.model';
import { AssignUsersPanelComponent } from './assign-users-panel.component';
import { CompanyUserProfileService } from 'src/app/core/services/company-user-profile.service';
import { AssignRoleToPersonRequest } from 'src/app/core/models/company-user-profile.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-profiles',
  templateUrl: './profiles.component.html',
  styleUrls: ['./profiles.component.css'],
  imports: [ReactiveFormsModule, CommonModule, MatButtonModule, MatIconModule, AssignUsersPanelComponent],
  standalone: true
})

export class ProfilesComponent implements OnInit {
  roles: Role[] = [];
  roleForm!: FormGroup;
  selectedRole: Role | null = null;
  activeCompany$: Observable<any>;
  activeCompany: any;
  loading = false;
  error: any = null;

  assignPanelOpen = false;
  assignPanelRole: Role | null = null;
  people: People[] = [];
  assignedUserIds: number[] = [];

  availablePermissions: { [key: string]: string[] } = {
    Profiles: ['List', 'Edit', 'Delete'],
    People: ['List', 'Edit', 'Delete'],
    Areas: ['List', 'Edit', 'Delete'],
    Locations: ['List', 'Edit', 'Delete'],
    Schedule: ['List', 'Edit', 'Delete'],
    Tasks: ['List', 'Edit', 'Delete'],
  };
  // Helper for iterating over object keys in the template
  objectKeys = Object.keys;

  constructor(
    private roleService: RoleService,
    private peopleService: PeopleService,
    private profileService: CompanyUserProfileService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }



  openAssignPanel(role: Role) {
    console.log('openAssignPanel called for role:', role);
    this.assignPanelRole = role;
    this.assignedUserIds = [];
    if (!this.activeCompany?.companyId) {
      console.warn('No active company found, opening panel anyway');
      this.assignPanelOpen = true;
      return;
    }

    // Load all people
    this.peopleService.getPeople(this.activeCompany.companyId, 1, 1000, '').subscribe(
      (people: People[]) => {
        console.log('People loaded:', people.length);
        this.people = people;

        // Load profiles for this role to determine who is already assigned
        this.profileService.getRoleProfiles(this.activeCompany.companyId, role.roleId).subscribe(
          (profiles) => {
            console.log('Role profiles loaded:', profiles.length);
            // Extract personIds from active profiles
            this.assignedUserIds = profiles
              .filter(p => p.isActive && p.personId)
              .map(p => p.personId!);
            console.log('Assigned user IDs from profiles:', this.assignedUserIds);
          },
          (error) => {
            console.error('Error loading role profiles:', error);
            // Continue anyway - panel will show with empty assignments
          }
        );
      },
      (error) => {
        console.error('Error loading people:', error);
      }
    );
    
    this.assignPanelOpen = true;
    console.log('assignPanelOpen set to:', this.assignPanelOpen);
  }

  closeAssignPanel() {
    this.assignPanelOpen = false;
    this.assignPanelRole = null;
    this.assignedUserIds = [];
  }


  saveAssignments(userIds: number[]) {
    if (!this.assignPanelRole || !this.activeCompany?.companyId) {
      this.toastr.error('Unable to save assignments');
      return;
    }

    const roleId = this.assignPanelRole.roleId;
    const companyId = this.activeCompany.companyId;

    // Determine which users to add and which to remove
    const usersToAdd = userIds.filter(id => !this.assignedUserIds.includes(id));
    const usersToRemove = this.assignedUserIds.filter(id => !userIds.includes(id));

    const requests: Observable<any>[] = [];

    // Create assignment requests for new users
    usersToAdd.forEach(personId => {
      const request: AssignRoleToPersonRequest = {
        personId,
        roleId
      };
      requests.push(this.profileService.assignRoleToPerson(companyId, request));
    });

    // For users to remove, we need to get their profile IDs first
    if (usersToRemove.length > 0) {
      this.profileService.getRoleProfiles(companyId, roleId).subscribe(
        (profiles) => {
          profiles
            .filter(p => p.personId && usersToRemove.includes(p.personId))
            .forEach(profile => {
              requests.push(this.profileService.removeRoleAssignment(companyId, profile.profileId));
            });

          // Execute all requests
          this.executeAssignmentRequests(requests);
        },
        (error) => {
          console.error('Error loading profiles for removal:', error);
          this.toastr.error('Error removing role assignments');
        }
      );
    } else {
      // No removals, just execute additions
      this.executeAssignmentRequests(requests);
    }
  }

  private executeAssignmentRequests(requests: Observable<any>[]) {
    if (requests.length === 0) {
      this.toastr.info('No changes to save');
      this.closeAssignPanel();
      return;
    }

    forkJoin(requests).subscribe(
      () => {
        this.toastr.success('Role assignments updated successfully');
        this.closeAssignPanel();
      },
      (error) => {
        console.error('Error saving assignments:', error);
        this.toastr.error('Error updating role assignments');
        this.closeAssignPanel();
      }
    );
  }

    ngOnInit(): void {
      this.activeCompany$.subscribe((company: any) => {
        if (company) {
          this.activeCompany = company;
          this.loading = true;
          this.roleService.getRoles(company.companyId).subscribe(          
            (roles: Role[]) => {
              this.roles = roles;
              this.loading = false;
              console.log('Roles fetched:', this.roles);
            },
            (error: any) => {
              this.error = error;
              this.loading = false;
            }
          );
          // Fetch people for assignment panel
          this.peopleService.getPeople(company.companyId, 1, 1000, '').subscribe(
            (people: People[]) => {
              this.people = people;
            },
            (error: any) => {
              // Optionally handle error
            }
          );
        }
      });

      const permissionsGroup = this.fb.group({});
      for (const component of this.objectKeys(this.availablePermissions)) {
        for (const action of this.availablePermissions[component]) {
          permissionsGroup.addControl(`${component}.${action}`, new FormControl(false));
        }
      }

      this.roleForm = this.fb.group({
        name: ['', Validators.required],
        description: ['', Validators.required],
        status: ['Active', Validators.required],
        permissions: permissionsGroup,
      });
    }

  editRole(role: Role): void {
    this.selectedRole = role;
    console.log('Editing role:', role);
    this.roleForm.patchValue({
      name: role.name,
      description: role.description,
      status: role.status,
    });

    const permissionsGroup = this.roleForm.get('permissions') as FormGroup;
    permissionsGroup.reset(); // Set all to false first
    if (role.permissions) {
      for (const permission of role.permissions) {
        // When form control names contain dots, you must access them via the `controls`
        // object rather than the `get()` method, which interprets dots as path separators.
        const control = permissionsGroup.controls[permission];
        if (control) {
          control.setValue(true);
        }
      }
    }
  }

  cancelEdit(): void {
    this.selectedRole = null;
    this.roleForm.reset({
      name: '',
      description: '',
      status: 'Active',
    });
  }

  saveRole(): void {
    if (!this.roleForm.valid) {
      return;
    }

    const formValue = this.roleForm.value;
    const selectedPermissions = Object.keys(formValue.permissions)
      .filter(p => formValue.permissions[p]);

    if (this.selectedRole) {
      const updatedRole: Role = {
        ...this.selectedRole,
        ...formValue,
        permissions: selectedPermissions,
      };
      this.roleService.updateRole(this.activeCompany.companyId, updatedRole.roleId, updatedRole).subscribe(
        (result) => {
          const index = this.roles.findIndex(r => r.roleId === result.roleId);
          if (index > -1) {
            this.roles[index] = result;
          }
          this.toastr.success('Role updated successfully.');
          this.cancelEdit();
        },
        () => this.toastr.error('Failed to update role.')
      );
    } else {
      const newRole: Role = {
        name: formValue.name,
        description: formValue.description,
        status: formValue.status,
        permissions: selectedPermissions,
        companyId: this.activeCompany.companyId,
        roleId: 0,
      };
      console.log('newRole',newRole);
      this.roleService.createRole(this.activeCompany.companyId, newRole).subscribe((role: Role) => {
        this.roles.push(role);
        this.cancelEdit();
        this.toastr.success('Role created successfully');
      });
    }
  }

  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
