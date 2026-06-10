import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { CompanyUser } from 'src/app/core/models/company-user.model';
import { Company } from 'src/app/core/models/company.model';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { selectCompanies } from 'src/app/store/company/company.selectors';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AppState } from 'src/app/store/app.state';
import { loadCompanies } from 'src/app/store/company/company.actions';

@Component({
  selector: 'app-company-users-admin',
  templateUrl: './company-users-admin.component.html',
  styleUrls: ['./company-users-admin.component.css'],
  standalone: false
})
export class CompanyUsersAdminComponent implements OnInit {
  companies: Company[] = [];
  selectedCompanyId = '';
  companyUsers: CompanyUser[] = [];
  loading = false;
  togglingId: string | null = null;

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
    this.loadUsers();
  }

  loadUsers(): void {
    if (!this.selectedCompanyId) return;
    this.loading = true;
    this.companyUsersService.getCompanyUsers(this.selectedCompanyId).subscribe({
      next: (users) => {
        this.companyUsers = users;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load company users');
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
        this.toastr.success(`User ${user.email} ${newStatus ? 'activated' : 'deactivated'}`);
        this.togglingId = null;
      },
      error: () => {
        this.toastr.error('Failed to update user status');
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
}
