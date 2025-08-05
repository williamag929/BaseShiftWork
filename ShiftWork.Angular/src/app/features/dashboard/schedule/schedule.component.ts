import { Component, OnInit, ViewChild } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import {
  CalendarOptions,
  EventInput,
} from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Observable } from 'rxjs';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { Location } from 'src/app/core/models/location.model';
import { LocationService } from 'src/app/core/services/location.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScheduleEditComponent } from '../schedule-edit/schedule-edit.component';
import { ToastrService } from 'ngx-toastr';
import { SharedModule } from "src/app/shared/shared.module";
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css'],
  providers: [ScheduleService, PeopleService, LocationService],
  imports: [SharedModule],

})
export class ScheduleComponent implements OnInit {

  @ViewChild('calendar')
  calendarComponent!: FullCalendarComponent;
  activeCompany$: Observable<any>;
  activeCompany: any;
  schedules: Schedule[] = [];
  people: People[] = [];
  locations: Location[] = [];
  calendarOptions: CalendarOptions = {};
  events: EventInput[] = [];
  loading = false;
  error: any = null;
  selectedLocationId: any;

  constructor(
    private scheduleService: ScheduleService,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private modalService: NgbModal,
    private store: Store<AppState>,
    private toastr: ToastrService
  ) {

    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
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
        this.peopleService.getPeople(company.companyId).subscribe((people: People[]) => {
          this.people = people;
        });
        this.locationService.getLocations(company.companyId).subscribe((locations) => {
          this.locations = locations;
        });
        this.scheduleService.getSchedules(company.companyId).subscribe({
          next: (schedules: Schedule[]) => {
            this.schedules = schedules;
            this.events = this.schedules.map(s => this.mapScheduleToEvent(s));
            this.calendarOptions.events = this.events;
            this.loading = false;
          },
          error: (error: any) => {
            this.error = error;
            this.loading = false;
          }
        });
      }
    });

    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      editable: true,
      selectable: true,
      select: this.handleDateSelect.bind(this),
      eventClick: this.handleEventClick.bind(this),
    };
  }

  private mapScheduleToEvent(schedule: Schedule): EventInput {
    const personName = this.people.find(p => p.personId === Number(schedule.personId))?.name || 'Unknown Person';
    const locationName = this.locations.find(l => l.locationId === schedule.locationId)?.name || 'Unknown Location';

    return {
      title: `${personName} - ${locationName}`,
      start: schedule.startDate,
      end: schedule.endDate,
      locationId: schedule.locationId,
      personId: schedule.personId,
      extendedProps: {
        schedule: schedule
      },
      color: schedule.color && schedule.color.toLowerCase() !== '#000000' ? schedule.color : undefined
    };
  }

  handleDateSelect(selectInfo: any) {
    const modalRef = this.modalService.open(ScheduleEditComponent);
    modalRef.componentInstance.schedule = {
      startDate: selectInfo.startStr,
      endDate: selectInfo.endStr,
      locationId: this.selectedLocationId,
      companyId: this.activeCompany.companyId
    };
    modalRef.result.then((result: Schedule) => {
      if (result) {
        this.scheduleService.createSchedule(this.activeCompany.id, result).subscribe((schedule: Schedule) => {
          this.schedules.push(schedule);
          this.events = [...this.events, this.mapScheduleToEvent(schedule)];
          this.calendarOptions.events = this.events;
          this.toastr.success('Schedule created successfully');
        });
      }
    });
  }

  handleEventClick(clickInfo: any) {
    const modalRef = this.modalService.open(ScheduleEditComponent);
    modalRef.componentInstance.schedule = clickInfo.event.extendedProps.schedule;
    modalRef.result.then((result: Schedule) => {
      if (result) {
        this.scheduleService.updateSchedule(
          this.activeCompany.id,
          result.scheduleId,
          result
        ).subscribe((schedule: Schedule) => {
          const index = this.schedules.findIndex((s: Schedule) => s.scheduleId === schedule.scheduleId);
          if (index > -1) {
            this.schedules[index] = schedule;
          }
          this.events = this.schedules.map(s => this.mapScheduleToEvent(s));
          this.calendarOptions.events = this.events;
          this.toastr.success('Schedule updated successfully');
        });
      }
    });
  }

  filterByLocation(event: any): void {
    const selectedValue = Number(event.target.value);
    if (isNaN(selectedValue) || selectedValue === 0) {
      this.selectedLocationId = null;
      this.events = this.schedules.map(s => this.mapScheduleToEvent(s));
      this.toastr.info('Showing all schedules');
    } else {
      this.selectedLocationId = selectedValue;
      this.events = this.schedules
        .filter((s: Schedule) => s.locationId === selectedValue)
        .map(s => this.mapScheduleToEvent(s));
      this.toastr.info('Filtered schedules by location');
    }
    this.calendarOptions.events = this.events;
  }
}
