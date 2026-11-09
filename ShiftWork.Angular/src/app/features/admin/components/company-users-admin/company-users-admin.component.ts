import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';

import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { CompanyUser } from 'src/app/core/models/company-user.model';
import { Company } from 'src/app/core/models/company.model';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { selectCompanies } from 'src/app/store/company/company.selectors';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AppState } from 'src/app/store/app.state';
import { paginate } from 'src/app/shared/ui';
import { loadCompanies } from 'src/app/store/company/company.actions';

@Component({
  selector: 'app-company-users-admin',
  templateUrl: './company-users-admin.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent]
})
export class CompanyUsersAdminComponent implements OnInit {
  companies: Company[] = [];
  selectedCompanyId = '';
  companyUsers: CompanyUser[] = [];
  loading = false;
  togglingId: string | null = null;
  loadError = false;
  page = 1;
  pageSize = 25;
  readonly paginate = paginate;

  constructor(
    private companyUsersService: CompanyUsersService,
    private store: Store<AppState>,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.store.dispatch(loadCompanies());
    this.store.select(selectCompanies).subscribe(companies => {
      this.companies = companies || [];
      // Auto-select active company
      if (!this.selectedCompanyId && this.companies.length > 0) {
        this.store.select(selectActiveCompany).subscribe(active => {
          if (active && !this.selectedCompanyId) {
            this.selectedCompanyId = active.companyId;
            this.loadUsers();
          } else if (!this.selectedCompanyId && this.companies.length > 0) {
            this.selectedCompanyId = this.companies[0].companyId;
            this.loadUsers();
          }
        }).unsubscribe();
      }
    });
  }

  onCompanyChange(): void {
    this.page = 1;
    this.loadUsers();
  }

  loadUsers(): void {
    if (!this.selectedCompanyId) return;
    this.loading = true;
    this.loadError = false;
    this.companyUsersService.getCompanyUsers(this.selectedCompanyId).subscribe({
      next: (users) => {
        this.companyUsers = users;
        this.page = Math.min(this.page, Math.max(1, Math.ceil(users.length / this.pageSize)));
        this.loading = false;
      },
      error: () => {
        this.loadError = true;
        this.toastr.error($localize`:@@company_users_admin.toast_load_failed:Could not load company users.`);
        this.loading = false;
      }
    });
  }

  toggleActive(user: CompanyUser): void {
    this.togglingId = user.companyUserId;
    const newStatus = !user.isActive;
    this.companyUsersService.setCompanyUserActive(this.selectedCompanyId, user.companyUserId, newStatus).subscribe({
      next: (updated) => {
        user.isActive = updated.isActive;
        this.toastr.success(newStatus
          ? $localize`:@@company_users_admin.toast_activated:User ${user.email}:email: activated.`
          : $localize`:@@company_users_admin.toast_deactivated:User ${user.email}:email: deactivated.`);
        this.togglingId = null;
      },
      error: () => {
        this.toastr.error($localize`:@@company_users_admin.toast_status_failed:Could not update the user status.`);
        this.togglingId = null;
      }
    });
  }

  getUidType(uid: string): string {
    if (!uid) return 'Unknown';
    if (uid.startsWith('api_')) return 'API';
    if (uid.startsWith('invite_')) return 'Invite';
    return 'Firebase';
  }

  uidTypeLabel(uid: string): string {
    switch (this.getUidType(uid)) {
      case 'API': return $localize`:@@company_users_admin.auth_api:API`;
      case 'Invite': return $localize`:@@company_users_admin.auth_invite:Invite`;
      case 'Firebase': return $localize`:@@company_users_admin.auth_firebase:Firebase`;
      default: return $localize`:@@company_users_admin.auth_unknown:Unknown`;
    }
  }

  toggleLabel(user: CompanyUser): string {
    return user.isActive
      ? $localize`:@@company_users_admin.deactivate_aria:Deactivate ${user.email}:email:`
      : $localize`:@@company_users_admin.activate_aria:Activate ${user.email}:email:`;
  }
}
