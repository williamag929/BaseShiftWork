// photo-schedule.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebcamModule, WebcamImage, WebcamInitError } from 'ngx-webcam';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { People } from 'src/app/core/models/people.model';
import { Router } from '@angular/router';
import { KioskService } from '../core/services/kiosk.service';
import { TimerService } from '../core/services/timer.service';
import { ScheduleEmployee } from '../core/models/schedule-employee.model';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { ShiftEvent } from 'src/app/core/models/shift-event.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { ScheduleShiftService } from 'src/app/core/services/schedule-shift.service';
import { ScheduleShift } from 'src/app/core/models/schedule-shift.model';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleDetail } from 'src/app/core/models/schedule-detail.model';
import { co } from '@fullcalendar/core/internal-common';
import { Location } from '../../../core/models/location.model';


export enum ScheduleAction {
  START_SHIFT = 'clockin',
  END_SHIFT = 'clockout',
  START_BREAK = 'startBreak',
  END_BREAK = 'endBreak'
}

@Component({
  selector: 'app-photo-schedule',
  standalone: true,
  imports: [WebcamModule, CommonModule],
  templateUrl: './photo-schedule.component.html',
  styleUrls: ['./photo-schedule.component.css'],

})
export class PhotoScheduleComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly trigger = new Subject<void>();

  // Constants
  private readonly PHOTO_DELAY_MS = 3000;
  private readonly CLEAR_DELAY_MS = 6000;
  private readonly COUNTDOWN_START = 3;

  // Public properties
  selectedEmployee: People | null = null;
  employeeStatus: string | null = null;
  employeeSchedule: ScheduleDetail | null = null;
  schedulesToday: ScheduleDetail[] = [];
  selectedLocation: Location | null = null;

  webcamImage: WebcamImage | null = null;
  flippedImage: string | null = null;
  scheduling = false;
  activeCompany$: Observable<any>;
  activeCompany: any;

  // Observables
  countdown$ = this.timerService.countdown;
  triggerObservable$ = this.trigger.asObservable();

  // Expose enum to template
  readonly ScheduleAction = ScheduleAction;

  constructor(
    private readonly kioskService: KioskService,
    private readonly timerService: TimerService,
    private readonly router: Router,
    private readonly shiftEventService: ShiftEventService,
    private readonly peopleService: PeopleService,
    private readonly scheduleShiftService: ScheduleShiftService,
    private readonly store: Store<AppState>,
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.selectedEmployee = navigation.extras.state['employee'];
      this.selectedLocation = kioskService.getSelectedLocation() || null;
      console.log('Selected employee from navigation state:', this.selectedEmployee);
    }
    this.activeCompany$ = this.store.select(selectActiveCompany);

  }

  ngOnInit(): void {
    if (this.selectedEmployee) {
      this.activeCompany$.subscribe((company: { companyId: string }) => {
        if (company) {
          this.activeCompany = company;
          this.employeeStatus = this.selectedEmployee?.status || null;
          console.log('Employee status:', this.employeeStatus);
          this.peopleService.getPersonStatus(company.companyId, Number(this.selectedEmployee?.personId))
            .pipe(takeUntil(this.destroy$))
            .subscribe(status => {
              this.employeeStatus = status;
              console.log('Employee status:', status);
            });

          if (this.selectedEmployee) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.employeeSchedule = this.selectedEmployee.scheduleDetails?.find(s => {
              const scheduleDate = new Date(s.startDate);
              scheduleDate.setHours(0, 0, 0, 0);
              console.log('dates:',scheduleDate.getTime(),'-', today.getTime())
              return s.personId === this.selectedEmployee?.personId && scheduleDate.getTime() === today.getTime();
            }) || null;

            console.log('Employee schedule:', this.employeeSchedule);
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.trigger.complete();
  }

  /**
   * Triggers the photo capture process with countdown
   */
  triggerImage(action?: ScheduleAction): void {
    if (this.scheduling) return;

    this.scheduling = true;
    this.startCountdown();

    setTimeout(() => {
      this.capturePhoto();
      if (action) {
        this.setSchedule(action);
      }
    }, this.PHOTO_DELAY_MS);

    setTimeout(() => {
      this.clearEmployee();
    }, this.CLEAR_DELAY_MS);
  }

  /**
   * Clears the current photo and resets the component state
   */
  clearEmployee(): void {
    this.webcamImage = null;
    this.flippedImage = null;
    this.scheduling = false;
    this.router.navigate(['/kiosk/employee-list']);
  }

  /**
   * Handles the captured webcam image
   */
  handleImage(webcamImage: WebcamImage): void {
    if (!webcamImage?.imageAsDataUrl) return;

    this.webcamImage = webcamImage;
    this.flipImage(webcamImage.imageAsDataUrl);
  }

  /**
   * Handles webcam initialization errors
   */
  handleInitError(error: WebcamInitError): void {
    console.error('Webcam initialization error:', error);
    // Add user notification here
  }

  private startCountdown(): void {
    this.timerService.countdown = this.COUNTDOWN_START;
    this.timerService.startTimer();
  }

  private capturePhoto(): void {
    this.trigger.next();
  }

  private setSchedule(action: ScheduleAction): void {
    if (!this.selectedEmployee || !this.selectedEmployee.companyId) {
      console.error('No employee selected for scheduling or companyId is missing');
      return;
    }

    const now = new Date();
    const scheduleEmployee: ScheduleEmployee = {
      employee: this.selectedEmployee,
      action: action,
      dateTime: now.toString(),
      dateTimeUTC: this.convertToUTC(now).toISOString(),
      location: {}
    };

    const newShiftEvent: ShiftEvent = {
      eventLogId: '00000000-0000-0000-0000-000000000000', // Should be generated by the backend
      eventDate: now,
      eventType: action,
      companyId: this.selectedEmployee.companyId,
      personId: this.selectedEmployee.personId,
      eventObject: JSON.stringify(this.selectedLocation || {}),
      description: `User ${this.selectedEmployee.name} ${action}`,
      kioskDevice: 'KioskName', // Replace with actual kiosk device identifier
      geoLocation: '{70.00,-41.00}', // Replace with actual geo location if available
      photoUrl: ''//this.flippedImage.imageAsDataUrl || null
    };

    console.log('Schedule Employee:', newShiftEvent);

    this.shiftEventService.createShiftEvent(this.selectedEmployee.companyId, newShiftEvent)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => console.log('Shift event created:', event),
        error: (err) => console.error('Error creating shift event:', err)
      });

    console.log('Schedule created:', scheduleEmployee);
    this.kioskService.setscheduleEmployee(scheduleEmployee);
  }

  private formatDateForInput(date: Date | string | undefined): string {
    if (!date) {
      return '';
    }
    const d = new Date(date);
    // Format to 'yyyy-MM-ddTHH:mm' which is required for datetime-local input
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private flipImage(src: string): void {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width, 0);

      this.flippedImage = canvas.toDataURL();
    };

    img.onerror = () => {
      console.error('Failed to load image for flipping');
    };

    img.src = src;
  }

  private convertToUTC(date: Date): Date {
    return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
  }
}
