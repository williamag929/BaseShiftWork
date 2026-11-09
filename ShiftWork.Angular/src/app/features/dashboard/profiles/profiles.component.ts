import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Role } from 'src/app/core/models/role.model';
import { RoleService } from 'src/app/core/services/role.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { People } from 'src/app/core/models/people.model';
import { CompanyUserProfileService } from 'src/app/core/services/company-user-profile.service';
import { AssignRoleToPersonRequest } from 'src/app/core/models/company-user-profile.model';
import { paginate } from 'src/app/shared/ui';

@Component({
  selector: 'app-profiles',
  templateUrl: './profiles.component.html',
  standalone: false
})

export class ProfilesComponent implements OnInit {
  roles: Role[] = [];
  roleForm!: FormGroup;
  selectedRole: Role | null = null;
  activeCompany$: Observable<any>;
  activeCompany: any;
  loading = false;
  error: any = null;
  panelOpen = false;
  openerEl: HTMLElement | null = null;
  saving = false;
  formError = '';
  page = 1;
  pageSize = 25;
  readonly paginate = paginate;
  assignOpener: HTMLElement | null = null;
  @ViewChild('addBtn') private addBtn?: ElementRef<HTMLElement>;

  assignPanelOpen = false;
  assignPanelRole: Role | null = null;
  people: People[] = [];
  assignedUserIds: number[] = [];

  availablePermissions: { [key: string]: string[] } = {
    'People':               ['people.read', 'people.create', 'people.update', 'people.delete'],
    'Schedules':            ['schedules.read', 'schedules.create', 'schedules.update', 'schedules.delete'],
    'Schedule Shifts':      ['schedule-shifts.read', 'schedule-shifts.create', 'schedule-shifts.update', 'schedule-shifts.delete'],
    'Shift Events':         ['shift-events.read', 'shift-events.create', 'shift-events.update', 'shift-events.delete'],
    'Crews':                ['crews.read', 'crews.create', 'crews.update', 'crews.delete', 'crews.assign'],
    'Locations':            ['locations.read', 'locations.create', 'locations.update', 'locations.delete'],
    'Areas':                ['areas.read', 'areas.create', 'areas.update', 'areas.delete'],
    'Tasks':                ['tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete'],
    'Roles':                ['roles.read', 'roles.create', 'roles.update', 'roles.delete', 'roles.permissions.update'],
    'Permissions':          ['permissions.read'],
    'Company Users':        ['company-users.read', 'company-users.update', 'company-users.roles.update', 'company-users.profile.update'],
    'Time Off':             ['timeoff-requests.read', 'timeoff-requests.create', 'timeoff-requests.approve', 'timeoff-requests.delete'],
    'PTO':                  ['pto.read', 'pto.update'],
    'Replacement Requests': ['replacement-requests.read', 'replacement-requests.create', 'replacement-requests.update', 'replacement-requests.delete'],
    'Shift Summaries':      ['schedule-shift-summaries.read', 'shift-summary-approvals.update'],
    'Company Settings':     ['company-settings.read', 'company-settings.update'],
    'Audit History':        ['audit-history.read'],
    'Kiosk':                ['kiosk.admin'],
    'Bulletins':            ['bulletins.read', 'bulletins.create', 'bulletins.delete', 'bulletins.track-reads'],
    'Daily Reports':        ['reports.read', 'reports.submit', 'reports.approve', 'reports.export'],
    'Documents':            ['documents.read', 'documents.upload', 'documents.delete', 'documents.manage'],
    'Credentials':          ['credentials.read', 'credentials.create', 'credentials.update', 'credentials.delete', 'credentials.track'],
    'Safety':               ['safety.read', 'safety.create', 'safety.delete', 'safety.acknowledge', 'safety.track'],
  };
  objectKeys = Object.keys;

  readonly statusLabels: Record<string, string> = {
    Active: $localize`:@@common.active:Active`,
    Inactive: $localize`:@@common.inactive:Inactive`,
  };

  private readonly groupLabels: Record<string, string> = {
    'People': $localize`:@@roles.group_people:People`,
    'Schedules': $localize`:@@roles.group_schedules:Schedules`,
    'Schedule Shifts': $localize`:@@roles.group_schedule_shifts:Schedule shifts`,
    'Shift Events': $localize`:@@roles.group_shift_events:Shift events`,
    'Crews': $localize`:@@roles.group_crews:Crews`,
    'Locations': $localize`:@@roles.group_locations:Locations`,
    'Areas': $localize`:@@roles.group_areas:Areas`,
    'Tasks': $localize`:@@roles.group_tasks:Tasks`,
    'Roles': $localize`:@@roles.group_roles:Roles`,
    'Permissions': $localize`:@@roles.group_permissions:Permissions`,
    'Company Users': $localize`:@@roles.group_company_users:Company users`,
    'Time Off': $localize`:@@roles.group_time_off:Time off`,
    'PTO': $localize`:@@roles.group_pto:PTO`,
    'Replacement Requests': $localize`:@@roles.group_replacement_requests:Replacement requests`,
    'Shift Summaries': $localize`:@@roles.group_shift_summaries:Shift summaries`,
    'Company Settings': $localize`:@@roles.group_company_settings:Company settings`,
    'Audit History': $localize`:@@roles.group_audit_history:Audit history`,
    'Kiosk': $localize`:@@roles.group_kiosk:Kiosk`,
    'Bulletins': $localize`:@@roles.group_bulletins:Bulletins`,
    'Daily Reports': $localize`:@@roles.group_daily_reports:Daily reports`,
    'Documents': $localize`:@@roles.group_documents:Documents`,
    'Credentials': $localize`:@@roles.group_credentials:Credentials`,
    'Safety': $localize`:@@roles.group_safety:Safety`,
  };

  private readonly actionLabels: Record<string, string> = {
    'read': $localize`:@@roles.perm_read:Read`,
    'create': $localize`:@@roles.perm_create:Create`,
    'update': $localize`:@@roles.perm_update:Update`,
    'delete': $localize`:@@roles.perm_delete:Delete`,
    'assign': $localize`:@@roles.perm_assign:Assign`,
    'approve': $localize`:@@roles.perm_approve:Approve`,
    'submit': $localize`:@@roles.perm_submit:Submit`,
    'export': $localize`:@@roles.perm_export:Export`,
    'upload': $localize`:@@roles.perm_upload:Upload`,
    'manage': $localize`:@@roles.perm_manage:Manage`,
    'acknowledge': $localize`:@@roles.perm_acknowledge:Acknowledge`,
    'track': $localize`:@@roles.perm_track:Track`,
    'track-reads': $localize`:@@roles.perm_track_reads:Track reads`,
    'admin': $localize`:@@roles.perm_admin:Admin`,
    'roles.permissions.update': $localize`:@@roles.perm_update_permissions:Update permissions`,
    'company-users.roles.update': $localize`:@@roles.perm_update_roles:Update roles`,
    'company-users.profile.update': $localize`:@@roles.perm_update_profile:Update profile`,
  };

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

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        this.loading = true;
        this.error = null;
        this.roleService.getRoles(company.companyId).subscribe({
          next: (roles: Role[]) => {
            this.roles = roles;
            this.loading = false;
            this.page = Math.min(this.page, Math.max(1, Math.ceil(roles.length / this.pageSize)));
          },
          error: (error: any) => {
            this.error = error;
            this.loading = false;
          }
        });
      }
    });

    const permissionsGroup = this.fb.group({});
    for (const component of this.objectKeys(this.availablePermissions)) {
      for (const permKey of this.availablePermissions[component]) {
        permissionsGroup.addControl(permKey, new FormControl(false));
      }
    }

    this.roleForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      status: ['Active', Validators.required],
      permissions: permissionsGroup,
    });
  }

  addRole(): void {
    this.resetPanel();
    this.panelOpen = true;
  }

  editRole(role: Role): void {
    this.resetPanel();
    this.selectedRole = role;
    this.roleForm.patchValue({
      name: role.name,
      description: role.description,
      status: role.status,
    });

    const permissionsGroup = this.roleForm.get('permissions') as FormGroup;
    if (role.permissions) {
      for (const permission of role.permissions) {
        // Permission keys contain dots, so address them through `controls` rather than `get()`.
        const control = permissionsGroup.controls[permission];
        if (control) {
          control.setValue(true);
        }
      }
    }
    this.roleForm.markAsPristine();
    this.panelOpen = true;
  }

  cancelEdit(): void {
    this.panelOpen = false;
    this.resetPanel();
  }

  private resetPanel(): void {
    this.selectedRole = null;
    this.formError = '';
    this.roleForm.reset({
      name: '',
      description: '',
      status: 'Active',
    });
    (this.roleForm.get('permissions') as FormGroup).reset();
  }

  saveRole(): void {
    if (!this.roleForm.valid || this.saving) {
      return;
    }

    const formValue = this.roleForm.value;
    const selectedPermissions = Object.keys(formValue.permissions)
      .filter(p => formValue.permissions[p]);
    this.saving = true;
    this.formError = '';

    if (this.selectedRole) {
      const updatedRole: Role = {
        ...this.selectedRole,
        ...formValue,
        permissions: selectedPermissions,
      };
      this.roleService.updateRole(this.activeCompany.companyId, updatedRole.roleId, updatedRole).subscribe({
        next: (result) => {
          const index = this.roles.findIndex(r => r.roleId === result.roleId);
          if (index > -1) {
            this.roles[index] = result;
          }
          this.saving = false;
          this.toastr.success($localize`:@@roles.toast_updated:Role updated.`);
          this.cancelEdit();
        },
        error: () => {
          this.saving = false;
          this.formError = $localize`:@@roles.toast_update_failed:Could not update the role.`;
        }
      });
    } else {
      const newRole: Role = {
        name: formValue.name,
        description: formValue.description,
        status: formValue.status,
        permissions: selectedPermissions,
        companyId: this.activeCompany.companyId,
        roleId: 0,
      };
      this.roleService.createRole(this.activeCompany.companyId, newRole).subscribe({
        next: (role: Role) => {
          this.roles.push(role);
          this.saving = false;
          this.cancelEdit();
          this.toastr.success($localize`:@@roles.toast_created:Role created.`);
        },
        error: () => {
          this.saving = false;
          this.formError = $localize`:@@roles.toast_create_failed:Could not create the role.`;
        }
      });
    }
  }

  openAssignPanel(role: Role, opener?: HTMLElement) {
    if (!this.activeCompany?.companyId) return;

    this.assignOpener = opener ?? null;
    this.assignPanelRole = role;
    this.assignedUserIds = [];
    this.people = [];

    forkJoin({
      people: this.peopleService.getPeople(this.activeCompany.companyId, 1, 1000, ''),
      profiles: this.profileService.getRoleProfiles(this.activeCompany.companyId, role.roleId)
    }).subscribe({
      next: ({ people, profiles }) => {
        this.people = people;
        this.assignedUserIds = profiles
          .filter(p => p.isActive && p.personId)
          .map(p => p.personId!);
        this.assignPanelOpen = true;
      },
      error: () => {
        this.assignPanelRole = null;
        this.toastr.error($localize`:@@roles.toast_assign_load_failed:Could not load assignment data.`);
      }
    });
  }

  closeAssignPanel() {
    const opener = this.assignOpener;
    this.assignPanelOpen = false;
    this.assignPanelRole = null;
    this.assignedUserIds = [];
    this.assignOpener = null;
    Promise.resolve().then(() => (opener?.isConnected ? opener : this.addBtn?.nativeElement)?.focus());
  }

  saveAssignments(userIds: number[]) {
    if (!this.assignPanelRole || !this.activeCompany?.companyId) {
      this.toastr.error($localize`:@@roles.toast_assign_unable:Unable to save assignments.`);
      return;
    }

    const roleId = this.assignPanelRole.roleId;
    const companyId = this.activeCompany.companyId;

    const usersToAdd = userIds.filter(id => !this.assignedUserIds.includes(id));
    const usersToRemove = this.assignedUserIds.filter(id => !userIds.includes(id));

    const requests: Observable<any>[] = [];

    usersToAdd.forEach(personId => {
      const request: AssignRoleToPersonRequest = {
        personId,
        roleId
      };
      requests.push(this.profileService.assignRoleToPerson(companyId, request));
    });

    // Removals need profile IDs, so fetch the role's profiles first.
    if (usersToRemove.length > 0) {
      this.profileService.getRoleProfiles(companyId, roleId).subscribe(
        (profiles) => {
          profiles
            .filter(p => p.personId && usersToRemove.includes(p.personId))
            .forEach(profile => {
              requests.push(this.profileService.removeRoleAssignment(companyId, profile.profileId));
            });

          this.executeAssignmentRequests(requests);
        },
        () => {
          this.toastr.error($localize`:@@roles.toast_assign_remove_failed:Could not remove role assignments.`);
        }
      );
    } else {
      this.executeAssignmentRequests(requests);
    }
  }

  private executeAssignmentRequests(requests: Observable<any>[]) {
    if (requests.length === 0) {
      this.toastr.info($localize`:@@roles.toast_assign_nochange:No changes to save.`);
      this.closeAssignPanel();
      return;
    }

    forkJoin(requests).subscribe(
      () => {
        this.toastr.success($localize`:@@roles.toast_assign_saved:Role assignments updated.`);
        this.closeAssignPanel();
      },
      () => {
        this.toastr.error($localize`:@@roles.toast_assign_failed:Could not update role assignments.`);
        this.closeAssignPanel();
      }
    );
  }

  readonly addRoleLabel = $localize`:@@roles.form_new:New role`;
  readonly nameError = $localize`:@@roles.name_error:Role name is required`;
  readonly descError = $localize`:@@roles.desc_error:Description is required`;

  get assignTitle(): string {
    return $localize`:@@assign_users.title:Assign users to ${this.assignPanelRole?.name ?? ''}:name:`;
  }

  roleEditLabel(role: Role): string {
    return $localize`:@@roles.edit_aria:Edit ${role.name}:name:`;
  }

  roleAssignLabel(role: Role): string {
    return $localize`:@@roles.assign_aria:Assign users to ${role.name}:name:`;
  }

  groupLabel(group: string): string {
    return this.groupLabels[group] ?? group;
  }

  statusLabel(status: string): string {
    return this.statusLabels[status] ?? status;
  }

  permissionCount(role: Role): number {
    return (role.permissions as string[] | undefined)?.length ?? 0;
  }

  /** Label for an API permission key, for example 'crews.assign' becomes 'Assign'. */
  getPermissionLabel(key: string): string {
    if (this.actionLabels[key]) return this.actionLabels[key];
    const action = key.split('.').pop() ?? key;
    return this.actionLabels[action] ?? action.charAt(0).toUpperCase() + action.slice(1);
  }
}
