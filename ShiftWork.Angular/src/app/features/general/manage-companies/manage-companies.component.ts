import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Company } from 'src/app/core/models/company.model';
import { People } from 'src/app/core/models/people.model';
import { CompanyService } from 'src/app/core/services/company.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { CompanyUser } from 'src/app/core/models/company-user.model';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  LzAlertComponent, LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent, LzEmptyStateComponent,
  LzPageHeaderComponent, LzPagerComponent, LzPanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent, paginate,
} from 'src/app/shared/ui';

@Component({
  selector: 'app-manage-companies',
  templateUrl: './manage-companies.component.html',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent,
    LzEmptyStateComponent, LzPageHeaderComponent, LzPagerComponent, LzPanelComponent, LzStatusChipComponent, LzTableDirective,
    LzTableScrollComponent,
  ]
})
export class ManageCompaniesComponent implements OnInit {
  companies: Company[] = [];
  selectedCompany: Company | null = null;

  // "In Company" — raw CompanyUser records from the API
  companyMembers: CompanyUser[] = [];
  // "Available" — people from the selected company not yet in companyMembers
  availablePeople: People[] = [];

  isLoading = false;
  isLoadingUsers = false;
  togglingId: string | null = null;
  loadError = false;
  usersError = false;
  readonly paginate = paginate;
  companyPage = 1;
  companyPageSize = 25;
  memberPage = 1;
  memberPageSize = 25;
  availablePage = 1;
  availablePageSize = 25;
  companyToDelete: Company | null = null;
  deletingCompanyId: string | null = null;
  memberToRemove: CompanyUser | null = null;
  private deleteOpener: HTMLElement | null = null;
  private removeOpener: HTMLElement | null = null;
  private focusMembersOnLoad = false;

  constructor(
    private companyService: CompanyService,
    private peopleService: PeopleService,
    private companyUsersService: CompanyUsersService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.loadError = false;
    this.companyService.getCompanies().subscribe({
      next: (data: any) => {
        this.companies = data;
        this.companyPage = Math.min(this.companyPage, Math.max(1, Math.ceil(data.length / this.companyPageSize)));
        this.isLoading = false;
      },
      error: (err: any) => {
        this.loadError = true;
        this.toastr.error($localize`:@@manage_companies.toast_load_failed:Could not load companies.`);
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  selectCompany(company: Company): void {
    this.selectedCompany = company;
    this.memberPage = 1;
    this.availablePage = 1;
    this.companyMembers = [];
    this.availablePeople = [];
    this.loadUsersForCompany(company.companyId);
  }

  loadUsersForCompany(companyId: string): void {
    this.isLoadingUsers = true;
    this.usersError = false;

    // Load CompanyUsers and People for the selected company in parallel
    this.companyUsersService.getCompanyUsers(companyId).subscribe({
      next: (members: CompanyUser[]) => {
        this.companyMembers = members;

        // Load people for this specific company to build the "available" list
        this.peopleService.getPeople(companyId).subscribe({
          next: (people: People[]) => {
            const memberEmails = new Set(
              members.map(m => (m.email || '').toLowerCase())
            );
            this.availablePeople = people.filter(
              p => !memberEmails.has((p.email || '').toLowerCase())
            );
            this.memberPage = Math.min(this.memberPage, Math.max(1, Math.ceil(this.companyMembers.length / this.memberPageSize)));
            this.availablePage = Math.min(this.availablePage, Math.max(1, Math.ceil(this.availablePeople.length / this.availablePageSize)));
            this.isLoadingUsers = false;
            if (this.focusMembersOnLoad) {
              this.focusMembersOnLoad = false;
              setTimeout(() => document.getElementById('mc-members-title')?.focus());
            }
          },
          error: (err: any) => {
            console.error('Failed to load people for company.', err);
            this.usersError = true;
            this.isLoadingUsers = false;
          }
        });
      },
      error: (err: any) => {
        this.usersError = true;
        this.toastr.error($localize`:@@manage_companies.toast_users_load_failed:Could not load users for this company.`);
        console.error(err);
        this.isLoadingUsers = false;
      }
    });
  }

  addUserToCompany(person: People): void {
    if (!this.selectedCompany) return;

    const newMember: CompanyUser = {
      companyUserId: '',
      companyId: this.selectedCompany.companyId,
      uid: `invite_${Date.now().toString(36)}`,
      email: person.email,
      displayName: person.name,
      photoURL: '',
      emailVerified: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.companyUsersService.createCompanyUser(this.selectedCompany.companyId, newMember).subscribe({
      next: () => {
        this.toastr.success($localize`:@@manage_companies.toast_added:${person.name}:person: added to ${this.selectedCompany?.name}:company:.`);
        this.loadUsersForCompany(this.selectedCompany!.companyId);
      },
      error: (err: any) => {
        this.toastr.error($localize`:@@manage_companies.toast_add_failed:Could not add the user.`);
        console.error(err);
      }
    });
  }

  askRemoveMember(member: CompanyUser, opener: HTMLElement): void {
    this.removeOpener = opener;
    this.memberToRemove = member;
  }

  cancelRemoveMember(): void {
    const opener = this.removeOpener;
    this.memberToRemove = null;
    this.removeOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmRemoveMember(): void {
    const member = this.memberToRemove;
    if (!member || !this.selectedCompany) return;
    const opener = this.removeOpener;
    this.memberToRemove = null;
    this.removeOpener = null;
    this.removeUserFromCompany(member, opener);
  }

  removeUserFromCompany(member: CompanyUser, opener: HTMLElement | null = null): void {
    if (!this.selectedCompany) return;

    this.companyUsersService.deleteCompanyUser(this.selectedCompany.companyId, member.companyUserId).subscribe({
      next: () => {
        this.toastr.success($localize`:@@manage_companies.toast_removed:${member.displayName || member.email}:user: removed from ${this.selectedCompany?.name}:company:.`);
        this.focusMembersOnLoad = true;
        this.loadUsersForCompany(this.selectedCompany!.companyId);
      },
      error: (err: any) => {
        this.toastr.error($localize`:@@manage_companies.toast_remove_failed:Could not remove the user.`);
        console.error(err);
        Promise.resolve().then(() => opener?.focus());
      }
    });
  }

  toggleActive(member: CompanyUser): void {
    if (!this.selectedCompany) return;
    this.togglingId = member.companyUserId;
    const newStatus = !member.isActive;
    this.companyUsersService.setCompanyUserActive(this.selectedCompany.companyId, member.companyUserId, newStatus).subscribe({
      next: (updated) => {
        member.isActive = updated.isActive;
        this.toastr.success(newStatus
          ? $localize`:@@manage_companies.toast_activated:${member.displayName || member.email}:user: activated.`
          : $localize`:@@manage_companies.toast_deactivated:${member.displayName || member.email}:user: deactivated.`);
        this.togglingId = null;
      },
      error: (err: any) => {
        this.toastr.error($localize`:@@manage_companies.toast_status_failed:Could not update the user status.`);
        console.error(err);
        this.togglingId = null;
      }
    });
  }

  createCompany(): void {
    this.router.navigate(['/admin/company/new']);
  }

  editCompany(company: Company): void {
    this.router.navigate(['/admin/company/edit', company.companyId]);
  }

  askDeleteCompany(company: Company, opener: HTMLElement): void {
    this.deleteOpener = opener;
    this.companyToDelete = company;
  }

  cancelDeleteCompany(): void {
    const opener = this.deleteOpener;
    this.companyToDelete = null;
    this.deleteOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmDeleteCompany(): void {
    const company = this.companyToDelete;
    if (!company) return;
    const opener = this.deleteOpener;
    this.companyToDelete = null;
    this.deleteOpener = null;
    this.deletingCompanyId = company.companyId;
    this.companyService.deleteCompany(company.companyId).subscribe({
      next: () => {
        this.deletingCompanyId = null;
        this.toastr.success($localize`:@@manage_companies.toast_deleted:Company deleted.`);
        this.loadCompanies();
        if (this.selectedCompany?.companyId === company.companyId) {
          this.selectedCompany = null;
          this.companyMembers = [];
          this.availablePeople = [];
        }
      },
      error: (err: any) => {
        this.deletingCompanyId = null;
        this.toastr.error($localize`:@@manage_companies.toast_delete_failed:Could not delete the company.`);
        console.error(err);
        Promise.resolve().then(() => opener?.focus());
      }
    });
  }

  get usersHeading(): string {
    return $localize`:@@manage_companies.users_for:Users for ${this.selectedCompany?.name ?? ''}:name:`;
  }

  get deleteCompanyTitle(): string {
    return $localize`:@@manage_companies.delete_title:Delete ${this.companyToDelete?.name ?? ''}:name:?`;
  }

  get removeMemberTitle(): string {
    return $localize`:@@manage_companies.remove_title:Remove ${this.memberToRemove?.displayName || this.memberToRemove?.email || ''}:name: from this company?`;
  }

  manageUsersLabel(company: Company): string {
    return $localize`:@@manage_companies.manage_users_aria:Manage users for ${company.name}:name:`;
  }

  editLabel(company: Company): string {
    return $localize`:@@manage_companies.edit_aria:Edit ${company.name}:name:`;
  }

  deleteLabel(company: Company): string {
    return $localize`:@@manage_companies.delete_aria:Delete ${company.name}:name:`;
  }

  toggleLabel(member: CompanyUser): string {
    const name = member.displayName || member.email;
    return member.isActive
      ? $localize`:@@manage_companies.deactivate_aria:Deactivate ${name}:name:`
      : $localize`:@@manage_companies.activate_aria:Activate ${name}:name:`;
  }

  removeLabel(member: CompanyUser): string {
    return $localize`:@@manage_companies.remove_aria:Remove ${member.displayName || member.email}:name:`;
  }

  addLabel(person: People): string {
    return $localize`:@@manage_companies.add_aria:Add ${person.name}:name:`;
  }
}
