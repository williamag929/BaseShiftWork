import type { ClockEventType, KioskConfig, KioskEmployee } from '@/types';

/** Used until a real config has been fetched or cached: the strictest behavior. */
export const STRICT_DEFAULT_CONFIG: KioskConfig = {
  requirePin: true,
  requirePhoto: true,
  questionsOnClockOutOnly: true,
};

export type PunchStep = 'pin' | 'photo' | 'questions' | 'commit';

const ORDER: PunchStep[] = ['pin', 'photo', 'questions', 'commit'];

/** "OnShift" and "OnShift:Late" etc. mean the next punch is a clock-out. */
export function nextEventType(status?: string | null): ClockEventType {
  return status && status.toLowerCase().startsWith('onshift') ? 'ClockOut' : 'ClockIn';
}

export function needsPhoto(config: KioskConfig, employee: KioskEmployee): boolean {
  return config.requirePhoto && !employee.photoExempt;
}

export interface FlowContext {
  config: KioskConfig;
  employee: KioskEmployee;
  eventType: ClockEventType;
  questionCount: number;
}

/** Which screen comes after `from`. 'start' means the employee was just tapped. */
export function nextStep(from: 'start' | PunchStep, ctx: FlowContext): PunchStep {
  const wanted: Record<PunchStep, boolean> = {
    pin: ctx.config.requirePin,
    photo: needsPhoto(ctx.config, ctx.employee),
    questions: ctx.eventType === 'ClockOut' && ctx.questionCount > 0,
    commit: true,
  };
  const startIdx = from === 'start' ? 0 : ORDER.indexOf(from) + 1;
  return ORDER.slice(startIdx).find((s) => wanted[s]) as PunchStep;
}

/** The post-clock-out screen needs the network; skip it when the kiosk looks offline. */
export function shouldShowInterstitial(
  eventType: ClockEventType | null,
  entries: ReadonlyArray<{ attempts: number }>,
): boolean {
  return eventType === 'ClockOut' && !entries.some((e) => e.attempts > 0);
}
