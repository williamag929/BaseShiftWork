import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TourStep {
  /** CSS element ID to highlight. Omit for a centred welcome/finish card. */
  targetId?: string;
  title: string;
  content: string;
  /** Which side of the target the tooltip appears on. Defaults to 'right'. */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly STORAGE_KEY = 'shiftwork_tour_v1';

  readonly steps: TourStep[] = [
    {
      title: '👋 Welcome to ShiftWork!',
      content:
        "This quick tour walks you through the key features. " +
        "You can skip it now and replay it anytime with the Help button.",
    },
    {
      targetId: 'tour-nav-schedule',
      title: '📅 Schedule Grid',
      content:
        'Your command centre. View all shifts in a weekly/monthly grid, ' +
        'create new shifts, and assign employees in seconds.',
      position: 'right',
    },
    {
      targetId: 'tour-nav-people',
      title: '👥 People',
      content:
        'Manage your workforce. Add employees, assign roles, set kiosk PINs, ' +
        'and send invite emails directly from here.',
      position: 'right',
    },
    {
      targetId: 'tour-nav-locations',
      title: '📍 Locations & Areas',
      content:
        'Set up the physical sites where your team works. ' +
        'Schedules and kiosks are each linked to a specific location.',
      position: 'right',
    },
    {
      targetId: 'tour-nav-kiosk',
      title: '📱 Kiosk',
      content:
        'Turn any tablet into a clock-in station. ' +
        'Employees clock in/out, answer questions, and can capture a photo.',
      position: 'right',
    },
    {
      targetId: 'tour-help-btn',
      title: "✅ You're all set!",
      content:
        "Click this button at any time to replay the tour. " +
        "Explore the app at your own pace — good luck!",
      position: 'bottom',
    },
  ];

  private _active$ = new BehaviorSubject<boolean>(false);
  private _stepIndex$ = new BehaviorSubject<number>(0);

  readonly active$ = this._active$.asObservable();
  readonly stepIndex$ = this._stepIndex$.asObservable();

  get currentStep(): TourStep | null {
    return this._active$.value ? (this.steps[this._stepIndex$.value] ?? null) : null;
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get currentIndex(): number {
    return this._stepIndex$.value;
  }

  get isActive(): boolean {
    return this._active$.value;
  }

  startTour(): void {
    this._stepIndex$.next(0);
    this._active$.next(true);
  }

  next(): void {
    const next = this._stepIndex$.value + 1;
    if (next >= this.steps.length) {
      this.endTour();
    } else {
      this._stepIndex$.next(next);
    }
  }

  prev(): void {
    const prev = this._stepIndex$.value - 1;
    if (prev >= 0) {
      this._stepIndex$.next(prev);
    }
  }

  endTour(): void {
    this._active$.next(false);
    localStorage.setItem(this.STORAGE_KEY, '1');
  }

  /** Returns true if the user has never seen the tour before. */
  shouldAutoStart(): boolean {
    return !localStorage.getItem(this.STORAGE_KEY);
  }
}
