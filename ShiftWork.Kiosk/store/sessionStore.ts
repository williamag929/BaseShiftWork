import { create } from 'zustand';
import type { KioskEmployee, ClockEventType } from '@/types';

// Transient per-transaction state — reset after successful clock action or timeout.
interface SessionState {
  employee: KioskEmployee | null;
  clockType: ClockEventType | null;
  capturedPhotoUri: string | null;
  geoLocation: string | null;
  /** True when success.tsx must make the clock API call (no-questions path). */
  needsClockSubmit: boolean;

  // Actions
  setEmployee: (employee: KioskEmployee) => void;
  setClockType: (type: ClockEventType) => void;
  setCapturedPhoto: (uri: string) => void;
  setGeoLocation: (geo: string) => void;
  setNeedsClockSubmit: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  employee: null,
  clockType: null,
  capturedPhotoUri: null,
  geoLocation: null,
  needsClockSubmit: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  setEmployee: (employee) => set({ employee }),
  setClockType: (clockType) => set({ clockType }),
  setCapturedPhoto: (capturedPhotoUri) => set({ capturedPhotoUri }),
  setGeoLocation: (geoLocation) => set({ geoLocation }),
  setNeedsClockSubmit: (needsClockSubmit) => set({ needsClockSubmit }),
  reset: () => set(initialState),
}));
