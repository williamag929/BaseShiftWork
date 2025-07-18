import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Role } from 'src/app/core/models/role.model';
import { RoleService } from 'src/app/core/services/role.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { ReactiveFormsModule } from '@angular/forms';
import { co } from '@fullcalendar/core/internal-common';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profiles',
  templateUrl: './profiles.component.html',
  styleUrls: ['./profiles.component.css'],
  imports: [ReactiveFormsModule,CommonModule],
  standalone: true,
  providers: [  RoleService, AuthService, ToastrService],
})
export class ProfilesComponent implements OnInit {
  roles: Role[] = [];
  roleForm!: FormGroup;
  loading = false;
  error: any = null;

  constructor(
    private roleService: RoleService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: { id: string }) => {
      if (company) {
        this.loading = true;
        this.roleService.getRoles(company.id).subscribe(
          (roles: Role[]) => {
            this.roles = roles.filter((r: Role) => r.companyId === company.id);
            this.loading = false;
          },
          (error: any) => {
            this.error = error;
            this.loading = false;
          }
        );
      }
    });

    this.roleForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required]
    });
  }

  createRole(): void {
    if (this.roleForm.valid) {
      const company = this.authService.activeCompany;
      if (!company) {
        this.toastr.error('No active company selected');
        return;
      }
      const newRole: Role = {
        id: null,
        ...this.roleForm.value,
        companyId: company.id
      };
      this.roleService.createRole(company.id, newRole).subscribe((role: Role) => {
        this.roles.push(role);
        this.roleForm.reset();
        this.toastr.success('Role created successfully');
      });
    }
  }
}
