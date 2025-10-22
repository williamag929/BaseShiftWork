import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Role } from 'src/app/core/models/role.model';
import { RoleService } from 'src/app/core/services/role.service';

@Component({
  selector: 'app-people',
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.css'],
  standalone: false
})
export class PeopleComponent implements OnInit {
  people: People[] = [];
  personForm!: FormGroup;
  selectedPerson: People | null = null;
  activeCompany$: Observable<any>;
  activeCompany: any;
  roles: Role[] = []; // Assuming roles are fetched from a service
  loading = false;
  error: any = null;

  constructor(
    private peopleService: PeopleService,
    private roleService: RoleService, // Assuming you have a RoleService to fetch roles
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        this.loading = true;
        this.peopleService.getPeople(company.companyId).subscribe(
          people => {
            this.people = people.filter(p => p.companyId === company.companyId);
            this.loading = false;
          },
          error => {
            this.error = error;
            this.loading = false;
          }
        );
        this.loading = true;
        this.roleService.getRoles(company.companyId).subscribe(
          roles => {
            this.roles = roles;
            this.loading = false;
          },
          error => {
            this.error = error;
            this.loading = false;
          }
        );
      }
    });

    this.personForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      pin: ['', [Validators.minLength(4), Validators.maxLength(4)]],
      address: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      externalCode: [''],
      status: ['Active', Validators.required],
      roleId: [null, Validators.required],
      photoUrl: ['']
    });
  }

  editPerson(person: People): void {
    this.selectedPerson = person;
    this.personForm.patchValue(person);
  }

  cancelEdit(): void {
    this.selectedPerson = null;
    this.personForm.reset({
      name: '',
      email: '',
      phoneNumber: '',
      pin: '',
      address: '',
      city: '',
      state: '',
      externalCode: '',
      status: 'Active',
      photoUrl: '',
      roleId: null
    });
  }

  savePerson(): void {
    if (!this.personForm.valid) {
      return;
    }

    if (this.selectedPerson) {
      const updatedPerson: People = {
        ...this.selectedPerson,
        ...this.personForm.value
      };
      // Note: You will need to implement `updatePerson` in your PeopleService.
      this.peopleService.updatePerson(this.activeCompany.companyId, updatedPerson.personId, updatedPerson).subscribe(
        (result) => {
          console.log('Updated person:', result);
          const index = this.people.findIndex(p => p.personId === result.personId);
          if (index > -1) {
            this.people[index] = result;
          }
          this.toastr.success('Person updated successfully.');
          this.cancelEdit();
        },
        () => this.toastr.error('Failed to update person.')
      );
    } else {
      const newPerson: People = {
        ...this.personForm.value,
        companyId: this.activeCompany.companyId
      };
      this.peopleService.createPerson(newPerson.companyId, newPerson).subscribe(person => {
        this.people.push(person);
        this.cancelEdit();
        this.toastr.success('Person created successfully');
      });
    }
  }

  getRoleName(roleId: any  | undefined): string {
    return this.roles.find(l => l.roleId === roleId)?.name || 'N/A';
  } 

}
