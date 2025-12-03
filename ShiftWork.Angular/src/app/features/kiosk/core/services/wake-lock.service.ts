import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private wakeLock: any | null = null;
  private supported = typeof window !== 'undefined' && typeof (navigator as any).wakeLock !== 'undefined';

  constructor(private zone: NgZone) {
    // Attach visibility listener only when supported and in browser
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        try {
          if (document.visibilityState === 'visible') {
            this.request();
          } else {
            this.release();
          }
        } catch {
          // ignore
        }
      });
    }
  }

  async request(): Promise<boolean> {
    try {
      if (!this.supported) {
        return false;
      }
      const navigatorAny = navigator as any;
      if (!navigatorAny.wakeLock || !navigatorAny.wakeLock.request) {
        return false;
      }
      // Run outside Angular to avoid change detection loops
      return await this.zone.runOutsideAngular(async () => {
        this.wakeLock = await navigatorAny.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
        return true;
      });
    } catch {
      this.wakeLock = null;
      return false;
    }
  }

  release(): void {
    try {
      if (this.wakeLock && this.wakeLock.release) {
        this.wakeLock.release();
      }
    } catch {
      // ignore
    } finally {
      this.wakeLock = null;
    }
  }

  isActive(): boolean {
    return !!this.wakeLock;
  }

  isSupported(): boolean {
    return this.supported;
  }
}
