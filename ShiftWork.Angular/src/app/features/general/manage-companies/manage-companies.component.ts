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
  allPeople: People[] = [];
  selectedCompany: Company | null = null;
  usersInCompany: People[] = [];
  usersNotInCompany: People[] = [];
  userCompanyLinks: CompanyUser[] = [];

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
    this.loadAllPeople();
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

  loadAllPeople(): void {
    // NOTE: This assumes `getPeople()` can fetch all users.
    // You may need to adjust the `people.service.ts` for this.
    this.peopleService.getPeople('').subscribe({
      next: (data: any) => {
        this.allPeople = data;
      },
      error: (err: any) => {
        this.toastr.error('Failed to load people.');
        console.error(err);
      }
    });
  }

  selectCompany(company: Company): void {
    this.selectedCompany = company;
    this.usersInCompany = [];
    this.usersNotInCompany = [];
    this.loadUsersForCompany(company.companyId);
  }

  loadUsersForCompany(companyId: string): void {
    this.isLoadingUsers = true;
    // NOTE: This assumes `getCompanyUsers()` can fetch all user-company links.
    // You may need a dedicated admin endpoint for this.
    this.companyUsersService.getCompanyUsers(companyId).subscribe({
      next: (links: any) => {
        this.userCompanyLinks = links;
        const userIdsInCompany = this.userCompanyLinks
          .filter(link => link.companyId === companyId)
          .map(link => link.uid); // Assuming userProfileId is personId

        this.usersInCompany = this.allPeople.filter(p => userIdsInCompany.includes(p.personId.toString()));
        this.usersNotInCompany = this.allPeople.filter(p => !userIdsInCompany.includes(p.personId.toString()));
        this.isLoadingUsers = false;
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

    const newUserCompany: CompanyUser = {
      companyUserId: '0', // API should handle this
      companyId: this.selectedCompany.companyId,
      uid: person.personId.toString(),
      email: '',
      displayName: '',
      photoURL: '',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.companyUsersService.createCompanyUser(this.selectedCompany.companyId, newUserCompany).subscribe({
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

  removeUserFromCompany(person: People): void {
    if (!this.selectedCompany) return;

    const linkToRemove = this.userCompanyLinks.find(
      link => link.companyId === this.selectedCompany?.companyId && link.uid === person.personId.toString()
    );

    if (!linkToRemove) {
      this.toastr.error('Could not find user-company link to remove.');
      return;
    }

    this.companyUsersService.deleteCompanyUser(this.selectedCompany.companyId, linkToRemove.companyUserId).subscribe({
      next: () => {
        this.toastr.success(`${person.name} removed from ${this.selectedCompany?.name}.`);
        this.loadUsersForCompany(this.selectedCompany!.companyId);
      },
      error: (err: any) => {
        this.toastr.error('Failed to remove user.');
        console.error(err);
      }
    });
  }

  createCompany(): void {
    //[routerLink]="['/admin/company/new']"
    this.router.navigate(['/admin/company/new']);
  }

  
  editCompany(company: Company): void {
    //[routerLink]="['/admin/company/edit', company.companyId]"
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
            this.usersInCompany = [];
            this.usersNotInCompany = [];
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
