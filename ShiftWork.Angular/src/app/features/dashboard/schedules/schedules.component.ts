import { Component, OnInit, OnDestroy } from '@angular/core';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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

@Component({
  selector: 'app-schedules',
  templateUrl: './schedules.component.html',
  styleUrls: ['./schedules.component.css'],
  imports: [DatePipe]
})
export class SchedulesComponent implements OnInit, OnDestroy {
  schedules: Schedule[] = [];
  people: People[] = [];
  locations: Location[] = [];
  areas: Area[] = [];

  loading = false;
  error: any = null;

  private peopleMap = new Map<number, string>();
  private locationMap = new Map<number, string>();
  private areaMap = new Map<number, string>();

  private destroy$ = new Subject<void>();

  constructor(
    private scheduleService: ScheduleService,
    private authService: AuthService,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private areaService: AreaService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.pipe(takeUntil(this.destroy$)).subscribe((company: { companyId: string }) => {
      if (company && company.companyId) {
        this.loading = true;
        this.error = null;

        forkJoin({
          schedules: this.scheduleService.getSchedules(company.companyId),
          people: this.peopleService.getPeople(company.companyId),
          locations: this.locationService.getLocations(company.companyId),
          areas: this.areaService.getAreas(company.companyId)
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
}
