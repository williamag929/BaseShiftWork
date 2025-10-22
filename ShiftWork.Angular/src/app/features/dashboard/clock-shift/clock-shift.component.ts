import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebcamModule, WebcamImage, WebcamInitError } from 'ngx-webcam';
import { Subject, takeUntil, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { People } from 'src/app/core/models/people.model';
import { Router } from '@angular/router';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { ShiftEvent } from 'src/app/core/models/shift-event.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleDetail } from 'src/app/core/models/schedule-detail.model';
import { ToastrService } from 'ngx-toastr';
import { AwsS3Service } from 'src/app/core/services/aws-s3.service';
import { MatDialog } from '@angular/material/dialog';
import { QuestionDialogComponent } from '../../kiosk/question-dialog/question-dialog.component';
import { KioskService } from '../../kiosk/core/services/kiosk.service';
import { KioskAnswer } from '../../kiosk/core/models/kiosk-answer.model';
import { TimerService } from '../../kiosk/core/services/timer.service';
import { Location } from 'src/app/core/models/location.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { Company } from 'src/app/core/models/company.model';

export enum ScheduleAction {
  START_SHIFT = 'clockin',
  END_SHIFT = 'clockout',
  START_BREAK = 'startBreak',
  END_BREAK = 'endBreak'
}

@Component({
  selector: 'app-clock-shift',
  templateUrl: './clock-shift.component.html',
  styleUrls: ['./clock-shift.component.css'],
  standalone: true,
  imports: [WebcamModule, CommonModule],
})
export class ClockShiftComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly trigger = new Subject<void>();

  private readonly PHOTO_DELAY_MS = 3000;
  private readonly CLEAR_DELAY_MS = 6000;
  private readonly COUNTDOWN_START = 3;

  currentUser: People | null = null;
  employeeStatus: string | null = null;
  employeeSchedule: ScheduleDetail | null = null;
  selectedLocation: Location | null = null;

  webcamImage: WebcamImage | null = null;
  flippedImage: string | null = null;
  scheduling = false;
  activeCompany$: Observable<Company | null>;
  activeCompany: Company | null = null;

  countdown$: Observable<number>;
  triggerObservable$: Observable<void>;

  readonly ScheduleAction = ScheduleAction;

  constructor(
    private readonly router: Router,
    private readonly shiftEventService: ShiftEventService,
    private readonly peopleService: PeopleService,
    private readonly store: Store<AppState>,
    private readonly awsS3Service: AwsS3Service,
    private readonly toastr: ToastrService,
    private readonly dialog: MatDialog,
    private readonly kioskService: KioskService,
    private readonly timerService: TimerService,
    private readonly authService: AuthService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
    this.countdown$ = this.timerService.countdown;
    this.triggerObservable$ = this.trigger.asObservable();
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe(company => {
      console.log('company', company);
      this.activeCompany = company;
      if (this.activeCompany) {
        this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe(user => {
          console.log('user', user);
          if (user && user.email) {
            this.peopleService.getPersonByEmail(this.activeCompany!.companyId, user.email).subscribe(person => {
              console.log('person', person);
              this.currentUser = person;
              if (this.currentUser) {
                this.employeeStatus = this.currentUser.status || null;
                this.peopleService.getPersonStatus(this.activeCompany!.companyId, this.currentUser.personId)
                  .pipe(takeUntil(this.destroy$))
                  .subscribe(status => {
                    this.employeeStatus = status;
                  });

                if (this.currentUser.scheduleDetails) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  this.employeeSchedule = this.currentUser.scheduleDetails.find(s => {
                    const scheduleDate = new Date(s.startDate);
                    scheduleDate.setHours(0, 0, 0, 0);
                    return s.personId === this.currentUser?.personId && scheduleDate.getTime() === today.getTime();
                  }) || null;

                  if (this.employeeSchedule && this.employeeSchedule.location) {
                    this.selectedLocation = this.employeeSchedule.location;
                  }
                }
              }
            });
          }
        });
      }
    });
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

          dialogRef.afterClosed().subscribe(answers => {
            if (answers) {
              this.proceedWithAction(action, answers);
            }
          });
        } else {
          this.proceedWithAction(action);
        }
      });
    } else {
      this.proceedWithAction(action || ScheduleAction.START_SHIFT);
    }
  }

  proceedWithAction(action: ScheduleAction, answers?: any) {
    this.scheduling = true;
    this.startCountdown();

    setTimeout(() => {
      this.capturePhoto();
      if(action) {
        this.setSchedule(action, answers);
      }
    }, this.PHOTO_DELAY_MS);

    setTimeout(() => {
      this.clearAction();
    }, this.CLEAR_DELAY_MS);
  }

  clearAction(): void {
    this.webcamImage = null;
    this.flippedImage = null;
    this.scheduling = false;
  }

  handleImage(webcamImage: WebcamImage): void {
    if (!webcamImage?.imageAsDataUrl) return;
    this.webcamImage = webcamImage;
    this.flipImage(webcamImage.imageAsDataUrl);
  }

  handleInitError(error: WebcamInitError): void {
    this.toastr.error(error.message, 'Webcam Error');
  }

  private startCountdown(): void {
    this.timerService.countdown = this.COUNTDOWN_START;
    this.timerService.startTimer();
  }

  private capturePhoto(): void {
    this.trigger.next();
  }

  private setSchedule(action: ScheduleAction, answers?: any): void {
    if (!this.currentUser || !this.currentUser.companyId || !this.currentUser.personId) {
      this.toastr.error('No employee selected for scheduling or companyId/personId is missing');
      return;
    }

    if (!this.flippedImage) {
      this.toastr.error('No photo captured');
      return;
    }

    const now = new Date();
    const blob = this.dataURItoBlob(this.flippedImage);
    const file = new File([blob], `${this.currentUser.personId}_${now.getTime()}.jpg`, { type: 'image/jpeg' });

    this.getCurrentPosition().subscribe({
      next: (coords) => {
        const geoLocation = `{${coords.latitude},${coords.longitude}}`;

        this.awsS3Service.uploadFile('shiftwork-photos', file).subscribe({
          next: (response: { message: string; }) => {
            const photoUrl = response.message;

            const newShiftEvent: ShiftEvent = {
              eventLogId: '00000000-0000-0000-0000-000000000000',
              eventDate: now,
              eventType: action,
              companyId: this.currentUser!.companyId,
              personId: this.currentUser!.personId,
              eventObject: JSON.stringify(this.selectedLocation || {}),
              description: `User ${this.currentUser!.name} ${action}`,
              kioskDevice: null,
              geoLocation: geoLocation,
              photoUrl: photoUrl
            };

            this.shiftEventService.createShiftEvent(this.currentUser!.companyId!, newShiftEvent)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (event) => {
                  this.toastr.success('Shift event created successfully');
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
                error: (err) => this.toastr.error('Error creating shift event')
              });
          },
          error: (err) => this.toastr.error('Error uploading photo')
        });
      },
      error: (err) => this.toastr.error('Error getting geolocation')
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

  private getCurrentPosition(): Observable<GeolocationCoordinates> {
    return new Observable(observer => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            observer.next(position.coords);
            observer.complete();
          },
          error => {
            observer.error(error);
          }
        );
      } else {
        observer.error('Geolocation is not supported by this browser.');
      }
    });
  }
}