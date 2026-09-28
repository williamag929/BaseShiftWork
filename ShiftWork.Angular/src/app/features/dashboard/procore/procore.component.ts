import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, switchMap, takeUntil, tap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ProcoreService } from 'src/app/core/services/procore.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ProcoreConnection } from 'src/app/core/models/procore-connection.model';
import { Location } from 'src/app/core/models/location.model';
import { People } from 'src/app/core/models/people.model';

@Component({
  selector: 'app-procore',
  templateUrl: './procore.component.html',
  styleUrls: ['./procore.component.css'],
  standalone: false
})
export class ProcoreComponent implements OnInit, OnDestroy {

  activeCompany$: Observable<any>;
  activeCompany: any;
  connection: ProcoreConnection | null = null;
  locations: Location[] = [];
  people: People[] = [];
  peopleFilter = '';
  connectionForm!: FormGroup;
  loading = false;
  saving = false;
  testing = false;
  error: any = null;
  private destroy$ = new Subject<void>();

  constructor(
    private procoreService: ProcoreService,
    private locationService: LocationService,
    private peopleService: PeopleService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.connectionForm = this.fb.group({
      procoreCompanyId: [''],
      clientId: [''],
      clientSecret: [''],
      baseUrl: ['https://api.procore.com', Validators.required],
      tokenUrl: ['https://login.procore.com/oauth/token', Validators.required],
      enabled: [false],
      autoPushOnSubmit: [true],
      timesheetSyncEnabled: [false]
    });

    this.activeCompany$.pipe(
      takeUntil(this.destroy$),
      tap(company => {
        this.activeCompany = company;
        this.loading = true;
        this.error = null;
      }),
      switchMap(company => {
        if (!company) {
          this.loading = false;
          return of({ connection: null, locations: [], people: [] });
        }
        return forkJoin({
          connection: this.procoreService.getConnection(company.companyId),
          locations: this.locationService.getLocations(company.companyId),
          people: this.peopleService.getPeople(company.companyId, 1, 500)
        }).pipe(
          catchError(error => {
            this.error = error;
            this.loading = false;
            return of({ connection: null, locations: [], people: [] });
          })
        );
      })
    ).subscribe(({ connection, locations, people }) => {
      this.connection = connection;
      this.locations = (locations || []).filter(l => l.companyId === this.activeCompany?.companyId);
      this.people = (people || []).filter(p => p.companyId === this.activeCompany?.companyId);
      if (connection) {
        this.connectionForm.patchValue({
          procoreCompanyId: connection.procoreCompanyId ?? '',
          clientId: connection.clientId ?? '',
          clientSecret: '',
          baseUrl: connection.baseUrl,
          tokenUrl: connection.tokenUrl,
          enabled: connection.enabled,
          autoPushOnSubmit: connection.autoPushOnSubmit,
          timesheetSyncEnabled: connection.timesheetSyncEnabled
        });
      }
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get mappedCount(): number {
    return this.locations.filter(l => !!l.externalCode).length;
  }

  get mappedEmployeeCount(): number {
    return this.people.filter(p => !!p.externalCode).length;
  }

  get filteredPeople(): People[] {
    const q = this.peopleFilter.trim().toLowerCase();
    if (!q) {
      return this.people;
    }
    return this.people.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.externalCode || '').toLowerCase().includes(q));
  }

  saveEmployeeMapping(person: People): void {
    if (!this.activeCompany) {
      return;
    }
    this.peopleService.updatePerson(this.activeCompany.companyId, person.personId, person).subscribe({
      next: () => this.toastr.success(`Procore worker ID saved for ${person.name}.`),
      error: () => this.toastr.error(`Failed to save mapping for ${person.name}.`)
    });
  }

  saveConnection(): void {
    if (!this.connectionForm.valid || !this.activeCompany) {
      return;
    }
    this.saving = true;
    const raw = this.connectionForm.value;
    const input = {
      ...raw,
      clientSecret: raw.clientSecret === '' ? undefined : raw.clientSecret
    };
    this.procoreService.saveConnection(this.activeCompany.companyId, input).subscribe({
      next: (connection) => {
        this.connection = connection;
        this.connectionForm.patchValue({ clientSecret: '' });
        this.saving = false;
        this.toastr.success('Procore connection saved.');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Failed to save connection.');
      }
    });
  }

  testConnection(): void {
    if (!this.activeCompany) {
      return;
    }
    this.testing = true;
    this.procoreService.testConnection(this.activeCompany.companyId).subscribe({
      next: (result) => {
        this.testing = false;
        if (result.success) {
          this.toastr.success(result.message || 'Connected to Procore.');
        } else {
          this.toastr.warning(result.message || 'Connection test failed.');
        }
      },
      error: () => {
        this.testing = false;
        this.toastr.error('Connection test failed.');
      }
    });
  }

  saveMapping(location: Location): void {
    if (!this.activeCompany) {
      return;
    }
    this.locationService.updateLocation(this.activeCompany.companyId, location.locationId, location).subscribe({
      next: () => this.toastr.success(`Mapping saved for ${location.name}.`),
      error: () => this.toastr.error(`Failed to save mapping for ${location.name}.`)
    });
  }
}
