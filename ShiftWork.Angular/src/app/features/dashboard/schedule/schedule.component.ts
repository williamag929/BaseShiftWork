import { Component, OnInit, ViewChild } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import {
  CalendarOptions,
  DateSelectArg,
  EventClickArg,
  EventApi,
} from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import { Calendar, CalendarApi, EventInput } from '@fullcalendar/core';
import { filter, map, Observable } from 'rxjs';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { Location } from 'src/app/core/models/location.model';
import { LocationService } from 'src/app/core/services/location.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScheduleEditComponent } from '../schedule-edit/schedule-edit.component';
import { ToastrService } from 'ngx-toastr';
import { SharedModule } from "src/app/shared/shared.module";


@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css'],
  providers: [ScheduleService, AuthService, PeopleService, LocationService],
  imports: [SharedModule],

})
export class ScheduleComponent implements OnInit {
  
  @ViewChild('calendar')
  calendarComponent!: FullCalendarComponent;

  schedules: Schedule[] = [];
  people: People[] = [];
  locations: Location[] = [];
  calendarOptions: CalendarOptions = {};
  events: EventInput[] = [];
  loading = false;
  error: any = null;

  constructor(
    private scheduleService: ScheduleService,
    private authService: AuthService,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private modalService: NgbModal,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: { id: string }) => {
      if (company) {
        this.loading = true;
        this.peopleService.getPeople(company.id).subscribe((people: People[]) => {
          this.people = people.filter((p: People) => p.companyId === company.id);
        });
        this.locationService.getLocations(company.id).subscribe((locations: Location[]) => {
          this.locations = locations.filter((l: Location) => l.companyId === company.id);
        });
        this.scheduleService.getSchedules(company.id).subscribe({
          next: (schedules: Schedule[]) => {
            this.schedules = schedules.filter((s: Schedule) => s.companyId === company.id);
            this.events = this.schedules.map((s: Schedule) => ({
              title: this.people.find((p: People) => p.personId === s.personId)?.name || 'Unknown',
              start: s.startTime,
              end: s.endTime,
              extendedProps: {
                schedule: s
              }
            }));
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
      //eventDrop: this.handleEventDrop.bind(this)
    };
  }

  handleDateSelect(selectInfo: any) {
    const modalRef = this.modalService.open(ScheduleEditComponent);
    modalRef.componentInstance.schedule = {
      startTime: selectInfo.startStr,
      endTime: selectInfo.endStr,
      companyId: this.authService.activeCompany.id
    };
    modalRef.result.then((result: Schedule) => {
      if (result) {
        this.scheduleService.createSchedule(this.authService.activeCompany.id, result).subscribe((schedule: Schedule) => {
          this.schedules.push(schedule);
          this.events.push({
            title: this.people.find((p: People) => p.personId === schedule.personId)?.name || 'Unknown',
            start: schedule.startTime,
            end: schedule.endTime,
            extendedProps: {
              schedule: schedule
            }
          });
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
          this.authService.activeCompany.id,
          result.scheduleId,
          result
        ).subscribe((schedule: Schedule) => {
          const index = this.schedules.findIndex((s: Schedule) => s.scheduleId === schedule.scheduleId);
          this.schedules[index] = schedule;
          this.events = this.schedules.map((s: Schedule) => ({
            title: this.people.find((p: People) => p.personId === s.personId)?.name || 'Unknown',
            start: s.startTime,
            end: s.endTime,
            extendedProps: {
              schedule: s
            }
          }));
          this.calendarOptions.events = this.events;
          this.toastr.success('Schedule updated successfully');
        });
      }
    });
  }

  filterByLocation(locationId: any): void {
    // TODO: Implement filter by location
  }
}
