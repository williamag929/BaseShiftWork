// photo-schedule.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebcamModule, WebcamImage, WebcamInitError } from 'ngx-webcam';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { People } from 'src/app/core/models/people.model';
import { KioskService } from '../core/services/kiosk.service';

import { TimerService } from '../core/services/timer.service';
import { ScheduleEmployee } from '../core/models/schedule-employee.model';

export enum ScheduleAction {
  START_SHIFT = 'startSchedule',
  END_SHIFT = 'endSchedule',
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
  webcamImage: WebcamImage | null = null;
  flippedImage: string | null = null;
  scheduling = false;
  
  // Observables
  countdown$ = this.timerService.countdown;
  triggerObservable$ = this.trigger.asObservable();

  // Expose enum to template
  readonly ScheduleAction = ScheduleAction;

  constructor(
    private readonly kioskService: KioskService,
    private readonly timerService: TimerService
  ) {}

  ngOnInit(): void {
    // Example: subscribe to employee selection observable from kioskService
    this.kioskService.selectedEmployee$
      .pipe(takeUntil(this.destroy$))
      .subscribe((employee: People | null) => {
        this.selectedEmployee = employee;
      });
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
    if (!this.selectedEmployee) {
      console.error('No employee selected for scheduling');
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

    console.log('Schedule created:', scheduleEmployee);
    this.kioskService.setscheduleEmployee(scheduleEmployee);
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