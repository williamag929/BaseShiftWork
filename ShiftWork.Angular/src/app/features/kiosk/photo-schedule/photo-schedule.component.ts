// photo-schedule.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebcamModule, WebcamImage, WebcamInitError } from 'ngx-webcam';
import { Subject, takeUntil, Observable } from 'rxjs';
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
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleDetail } from 'src/app/core/models/schedule-detail.model';
import { ToastrService } from 'ngx-toastr';
import { KioskAnswer } from '../core/models/kiosk-answer.model';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { QuestionDialogComponent } from '../question-dialog/question-dialog.component';
import { AwsS3Service } from 'src/app/core/services/aws-s3.service';
import { Company } from 'src/app/core/models/company.model';
import { Location } from 'src/app/core/models/location.model';

export enum ScheduleAction {
  START_SHIFT = 'clockin',
  END_SHIFT = 'clockout',
  START_BREAK = 'startBreak',
  END_BREAK = 'endBreak'
}

@Component({
  selector: 'app-photo-schedule',
  standalone: true,
  imports: [WebcamModule, CommonModule, MatDialogModule],
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
  activeCompany$: Observable<Company | null>;
  activeCompany: Company | null = null;

  // Observables
  countdown$: Observable<number>;
  triggerObservable$: Observable<void>;

  // Expose enum to template
  readonly ScheduleAction = ScheduleAction;

  // Derived UI helpers
  isOnShiftStatus(status: string | null | undefined): boolean {
    if (!status) return false;
    return status.startsWith('OnShift') || status === 'ShiftEventWithoutSchedule';
  }

  get hasPublishedScheduleToday(): boolean {
    return !!this.employeeSchedule;
  }

  canStartShift(): boolean {
    return !this.isOnShiftStatus(this.employeeStatus) && this.hasPublishedScheduleToday;
  }

  canEndShift(): boolean {
    return this.isOnShiftStatus(this.employeeStatus);
  }

  // Timing parsing for UI badge (Late/Early/OnTime/NoSchedule)
  getTimingFromStatus(status: string | null | undefined): string | null {
    if (!status) return null;
    const parts = status.split(':');
    return parts.length > 1 ? parts[1] : null;
  }

  getTimingBadgeClass(timing: string | null): string {
    switch (timing) {
      case 'OnTime':
        return 'bg-success';
      case 'Early':
        return 'bg-warning text-dark';
      case 'Late':
        return 'bg-danger';
      case 'NoSchedule':
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  }

  constructor(
    private readonly kioskService: KioskService,
    private readonly timerService: TimerService,
    private readonly router: Router,
    private readonly shiftEventService: ShiftEventService,
    private readonly peopleService: PeopleService,
    private readonly scheduleShiftService: ScheduleShiftService,
    private readonly store: Store<AppState>,
    private readonly awsS3Service: AwsS3Service,
    private readonly toastr: ToastrService,
    private readonly dialog: MatDialog
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
    this.countdown$ = this.timerService.countdown;
    this.triggerObservable$ = this.trigger.asObservable();
  }

  ngOnInit(): void {
    this.selectedEmployee = this.kioskService.getSelectedEmployee();
    this.selectedLocation = this.kioskService.getSelectedLocation() || null;

    if (this.selectedEmployee) {
      this.activeCompany$.subscribe((company: Company | null) => {
        if (company && this.selectedEmployee) {
          this.activeCompany = company;
          this.employeeStatus = this.selectedEmployee.statusShiftWork || null;
          if (this.selectedEmployee.personId) {
            this.peopleService.getPersonStatusShiftWork(company.companyId, this.selectedEmployee.personId)
              .pipe(takeUntil(this.destroy$))
              .subscribe((status: string) => {
                this.employeeStatus = status;
              });
          }

          if (this.selectedEmployee.scheduleDetails) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.employeeSchedule = this.selectedEmployee.scheduleDetails.find(s => {
              const scheduleDate = new Date(s.startDate);
              scheduleDate.setHours(0, 0, 0, 0);
              return s.personId === this.selectedEmployee?.personId && scheduleDate.getTime() === today.getTime();
            }) || null;
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

  triggerImage(action?: ScheduleAction): void {
    if (this.scheduling || !this.activeCompany) return;

    if (action === ScheduleAction.END_SHIFT) {
      this.kioskService.getKioskQuestions(this.activeCompany.companyId).subscribe(questions => {
        if (questions && questions.length > 0) {
          const dialogRef = this.dialog.open(QuestionDialogComponent, {
            width: '400px',
            data: { questions }
          });

          dialogRef.afterClosed().subscribe((answers: { [key: string]: string } | null) => {
            if (answers) {
              this.startScheduling(action, answers);
            }
          });
        } else {
          this.startScheduling(action);
        }
      });
    } else {
      this.startScheduling(action);
    }
  }

  private startScheduling(action?: ScheduleAction, answers?: { [key: string]: string }): void {
    this.scheduling = true;
    this.startCountdown();

    setTimeout(() => {
      this.capturePhoto();
      if (action) {
        this.setSchedule(action, answers);
      }
    }, this.PHOTO_DELAY_MS);

    setTimeout(() => {
      this.clearEmployee();
    }, this.CLEAR_DELAY_MS);
  }

  clearEmployee(): void {
    this.webcamImage = null;
    this.flippedImage = null;
    this.scheduling = false;
    setTimeout(() => {
      this.router.navigate(['/kiosk/employee-list']);
    }, 2000);
  }

  handleImage(webcamImage: WebcamImage): void {
    if (!webcamImage?.imageAsDataUrl) return;

    this.webcamImage = webcamImage;
    this.flipImage(webcamImage.imageAsDataUrl);
  }

  handleInitError(error: WebcamInitError): void {
    console.error('Webcam initialization error:', error);
    this.toastr.error('Webcam initialization error. Please check permissions and refresh.');
  }

  private startCountdown(): void {
    this.timerService.countdown = this.COUNTDOWN_START;
    this.timerService.startTimer();
  }

  private capturePhoto(): void {
    this.trigger.next();
  }

  private setSchedule(action: ScheduleAction, answers?: { [key: string]: string }): void {
    if (!this.selectedEmployee || !this.selectedEmployee.companyId || !this.selectedEmployee.personId) {
      this.toastr.error('No employee selected for scheduling or companyId/personId is missing');
      return;
    }

    if (!this.flippedImage) {
      this.toastr.error('No photo captured');
      return;
    }

    const now = new Date();
    const blob = this.dataURItoBlob(this.flippedImage);
    const file = new File([blob], `${this.selectedEmployee.personId}_${now.getTime()}.jpg`, { type: 'image/jpeg' });

    this.getCurrentPosition().subscribe({
      next: (coords: GeolocationCoordinates) => {
        const geoLocation = `{${coords.latitude},${coords.longitude}}`;

        this.awsS3Service.uploadFile('shiftwork-photos', file).subscribe({
          next: (response: { message: string }) => {
            const photoUrl = response.message;

            const newShiftEvent: ShiftEvent = {
              eventLogId: '00000000-0000-0000-0000-000000000000',
              eventDate: now,
              eventType: action,
              companyId: this.selectedEmployee!.companyId!,
              personId: this.selectedEmployee!.personId!,
              eventObject: JSON.stringify(this.selectedLocation || {}),
              description: `User ${this.selectedEmployee!.name} ${action}`,
              kioskDevice: this.getKioskDeviceIdentifier(),
              geoLocation: geoLocation,
              photoUrl: photoUrl
            };

            this.shiftEventService.createShiftEvent(this.selectedEmployee!.companyId!, newShiftEvent)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (event: ShiftEvent) => {
                  this.toastr.success('Shift event created successfully');
                  // Optimistically update local status
                  if (action === ScheduleAction.START_SHIFT) {
                    // Optimistic update; server will enrich with timing (Late/Early/OnTime)
                    this.employeeStatus = 'OnShift';
                    if (this.selectedEmployee) {
                      this.selectedEmployee.statusShiftWork = 'OnShift';
                    }
                  } else if (action === ScheduleAction.END_SHIFT) {
                    this.employeeStatus = 'OffShift';
                    if (this.selectedEmployee) {
                      this.selectedEmployee.statusShiftWork = 'OffShift';
                    }
                  }
                  if (answers) {
                    const kioskAnswers: KioskAnswer[] = Object.keys(answers).map(key => ({
                      kioskAnswerId: 0,
                      shiftEventId: event.eventLogId,
                      kioskQuestionId: parseInt(key, 10),
                      answerText: answers[key]
                    }));
                    this.kioskService.postKioskAnswers(kioskAnswers).subscribe();
                  }
                },
                error: (err: any) => this.toastr.error('Error creating shift event')
              });

            const scheduleEmployee: ScheduleEmployee = {
              employee: this.selectedEmployee!,
              action: action,
              dateTime: now.toString(),
              dateTimeUTC: this.convertToUTC(now).toISOString(),
              location: {}
            };
            this.kioskService.setscheduleEmployee(scheduleEmployee);
          },
          error: (err: any) => this.toastr.error('Error uploading photo')
        });
      },
      error: (err: any) => this.toastr.error('Error getting geolocation')
    });
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

  private getKioskDeviceIdentifier(): string {
    let kioskId = localStorage.getItem('kioskId');
    if (!kioskId) {
      kioskId = `kiosk-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('kioskId', kioskId);
    }
    return kioskId;
  }

  private getCurrentPosition(): Observable<GeolocationCoordinates> {
    return new Observable(observer => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position: GeolocationPosition) => {
            observer.next(position.coords);
            observer.complete();
          },
          (error: GeolocationPositionError) => {
            observer.error(error);
          }
        );
      } else {
        observer.error('Geolocation is not supported by this browser.');
      }
    });
  }

  private dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  private convertToUTC(date: Date): Date {
    return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
  }
}
