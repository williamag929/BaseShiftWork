import { create } from 'zustand';
import type { KioskAnswer, KioskEmployee, ClockEventType } from '@/types';

// Transient per-punch state. Cleared when a new punch starts and after the success screen.
interface SessionState {
  employee: KioskEmployee | null;
  clockType: ClockEventType | null;
  capturedPhotoUri: string | null;
  /** The PIN the employee just entered; kept only until the punch is recorded. */
  pin: string | null;
  answers: KioskAnswer[];
  /** Id of the recorded punch, used by Undo. Null until recorded. */
  eventLogId: string | null;
  /** True when the punch could not be saved on this tablet. */
  commitError: boolean;

  // Actions
  startPunch: (employee: KioskEmployee, clockType: ClockEventType) => void;
  setCapturedPhoto: (uri: string) => void;
  setPin: (pin: string) => void;
  setAnswers: (answers: KioskAnswer[]) => void;
  setCommitted: (eventLogId: string) => void;
  setCommitError: (failed: boolean) => void;
  reset: () => void;
}

const initialState = {
  employee: null,
  clockType: null,
  capturedPhotoUri: null,
  pin: null,
  answers: [] as KioskAnswer[],
  eventLogId: null,
  commitError: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  startPunch: (employee, clockType) => set({ ...initialState, employee, clockType }),
  setCapturedPhoto: (capturedPhotoUri) => set({ capturedPhotoUri }),
  setPin: (pin) => set({ pin }),
  setAnswers: (answers) => set({ answers }),
  setCommitted: (eventLogId) => set({ eventLogId, commitError: false, pin: null }),
  setCommitError: (commitError) => set({ commitError }),
  reset: () => set(initialState),
}));
