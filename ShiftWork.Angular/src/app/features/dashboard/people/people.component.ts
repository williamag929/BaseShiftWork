import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-people',
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.css'],
  standalone: false
})
export class PeopleComponent implements OnInit {
  people: People[] = [];
  personForm!: FormGroup;
  loading = false;
  error: any = null;

  constructor(
    private peopleService: PeopleService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: { id: string }) => {
      if (company) {
        this.loading = true;
        this.peopleService.getPeople(company.id).subscribe(
          people => {
            this.people = people.filter(p => p.companyId === company.id);
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
      phone: ['', Validators.required]
    });
  }

  createPerson(): void {
    if (this.personForm.valid) {
      const newPerson: People = {
        id: null,
        ...this.personForm.value,
        companyId: this.authService.activeCompany.id
      };
      this.peopleService.createPerson(newPerson.companyId, newPerson).subscribe(person => {
        this.people.push(person);
        this.personForm.reset();
        this.toastr.success('Person created successfully');
      });
    }
  }
}
