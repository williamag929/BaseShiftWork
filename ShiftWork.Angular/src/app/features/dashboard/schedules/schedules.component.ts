import { Component, OnInit, OnDestroy } from '@angular/core';
import { forkJoin, Subject } from 'rxjs';
import { Observable } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { LocationService } from 'src/app/core/services/location.service';
import { AreaService } from 'src/app/core/services/area.service';
import { Schedule } from 'src/app/core/models/schedule.model';
import { People } from 'src/app/core/models/people.model';
import { Location } from 'src/app/core/models/location.model';
import { Area } from 'src/app/core/models/area.model';
import { DatePipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { MatDialog } from '@angular/material/dialog';
import { ScheduleEditComponent } from '../schedules/schedule-edit/schedule-edit.component';

@Component({
  selector: 'app-schedules',
  templateUrl: './schedules.component.html',
  styleUrls: ['./schedules.component.css'],
  standalone: false,
  //imports: [DatePipe],

})
export class SchedulesComponent implements OnInit, OnDestroy {
  schedules: Schedule[] = [];
  people: People[] = [];
  locations: Location[] = [];
  areas: Area[] = [];
  activeCompany: any;

  loading = false;
  error: any = null;

  private peopleMap = new Map<number, string>();
  private locationMap = new Map<number, string>();
  private areaMap = new Map<number, string>();

  private destroy$ = new Subject<void>();
  activeCompany$: Observable<any>;

  constructor(
    private scheduleService: ScheduleService,
    private authService: AuthService,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private store: Store<AppState>,
    private areaService: AreaService,
    public dialog: MatDialog
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
        this.loadSchedules();
      }
    });
  }

  loadSchedules() {
    this.loading = true;
    this.error = null;

    forkJoin({
      schedules: this.scheduleService.getSchedules(this.activeCompany.companyId),
      people: this.peopleService.getPeople(this.activeCompany.companyId),
      locations: this.locationService.getLocations(this.activeCompany.companyId),
      areas: this.areaService.getAreas(this.activeCompany.companyId)
    }).subscribe({
      next: ({ schedules, people, locations, areas }) => {
        this.schedules = schedules;
        this.people = people;
        this.locations = locations;
        this.areas = areas;

        this.people.forEach(p => this.peopleMap.set(p.personId, p.name));
        this.locations.forEach(l => this.locationMap.set(l.locationId, l.name));
        this.areas.forEach(a => this.areaMap.set(a.areaId, a.name));

        this.loading = false;
      },
      error: (err) => {
        this.error = err;
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getPersonName(personId: number): string {
    return this.peopleMap.get(personId) || 'Unknown Person';
  }

  getLocationName(locationId: number): string {
    return this.locationMap.get(locationId) || 'Unknown Location';
  }

  getAreaName(areaId: number): string {
    return this.areaMap.get(areaId) || 'Unknown Area';
  }

  openScheduleDialog(schedule?: Schedule): void {
    const dialogRef = this.dialog.open(ScheduleEditComponent, {
      width: '500px',
      data: { schedule: schedule, people: this.people, locations: this.locations, areas: this.areas, companyId: this.activeCompany.companyId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSchedules();
      }
    });
  }
}
