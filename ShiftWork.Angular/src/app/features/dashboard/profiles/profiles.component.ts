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

@Component({
  selector: 'app-profiles',
  templateUrl: './profiles.component.html',
  styleUrls: ['./profiles.component.css'],
  imports: [ReactiveFormsModule,CommonModule],
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
        if (permissionsGroup.get(permission)) {
          permissionsGroup.get(permission)?.setValue(true);
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
}
