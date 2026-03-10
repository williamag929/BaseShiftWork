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

@Component({
  selector: 'app-manage-companies',
  templateUrl: './manage-companies.component.html',
  styleUrls: ['./manage-companies.component.scss'],
  standalone: true,
  imports: [CommonModule]
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
    this.companyService.getCompanies().subscribe({
      next: (data: any) => {
        this.companies = data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.toastr.error('Failed to load companies.');
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  selectCompany(company: Company): void {
    this.selectedCompany = company;
    this.companyMembers = [];
    this.availablePeople = [];
    this.loadUsersForCompany(company.companyId);
  }

  loadUsersForCompany(companyId: string): void {
    this.isLoadingUsers = true;

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
            this.isLoadingUsers = false;
          },
          error: (err: any) => {
            console.error('Failed to load people for company.', err);
            this.isLoadingUsers = false;
          }
        });
      },
      error: (err: any) => {
        this.toastr.error('Failed to load users for company.');
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
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.companyUsersService.createCompanyUser(this.selectedCompany.companyId, newMember).subscribe({
      next: () => {
        this.toastr.success(`${person.name} added to ${this.selectedCompany?.name}.`);
        this.loadUsersForCompany(this.selectedCompany!.companyId);
      },
      error: (err: any) => {
        this.toastr.error('Failed to add user.');
        console.error(err);
      }
    });
  }

  removeUserFromCompany(member: CompanyUser): void {
    if (!this.selectedCompany) return;

    this.companyUsersService.deleteCompanyUser(this.selectedCompany.companyId, member.companyUserId).subscribe({
      next: () => {
        this.toastr.success(`${member.displayName || member.email} removed from ${this.selectedCompany?.name}.`);
        this.loadUsersForCompany(this.selectedCompany!.companyId);
      },
      error: (err: any) => {
        this.toastr.error('Failed to remove user.');
        console.error(err);
      }
    });
  }

  createCompany(): void {
    this.router.navigate(['/admin/company/new']);
  }

  editCompany(company: Company): void {
    this.router.navigate(['/admin/company/edit', company.companyId]);
  }

  deleteCompany(company: Company): void {
    if (confirm(`Are you sure you want to delete ${company.name}?`)) {
      this.companyService.deleteCompany(company.companyId).subscribe({
        next: () => {
          this.toastr.success('Company deleted.');
          this.loadCompanies();
          if (this.selectedCompany?.companyId === company.companyId) {
            this.selectedCompany = null;
            this.companyMembers = [];
            this.availablePeople = [];
          }
        },
        error: (err: any) => {
          this.toastr.error('Failed to delete company.');
          console.error(err);
        }
      });
    }
  }
}
