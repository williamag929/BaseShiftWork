import { useDeviceStore } from '@/store/deviceStore';
import type { ClockEventType, KioskAnswer, KioskEmployee } from '@/types';
import { getLastKnownGeo } from './geo.service';
import { outbox } from './outbox';
import { UNDO_HOLD_MS } from './outbox.service';

export interface CommitInput {
  employee: KioskEmployee;
  eventType: ClockEventType;
  pin?: string;
  photoUri?: string;
  answers?: KioskAnswer[];
}

/**
 * Double-tap guard: a second commit for the same person inside the undo window
 * returns the first punch instead of recording an In followed by an Out.
 */
const recent = new Map<number, { eventLogId: string; at: number }>();

/** Call after Undo so the employee can punch again right away. */
export function forgetRecentPunch(personId: number): void {
  recent.delete(personId);
}

/** Records the punch on this tablet (it is sent in the background) and returns its id. */
export async function commitPunch(
  input: CommitInput,
  now: () => number = Date.now
): Promise<{ eventLogId: string }> {
  const prior = recent.get(input.employee.personId);
  if (prior && now() - prior.at < UNDO_HOLD_MS) {
    return { eventLogId: prior.eventLogId };
  }

  const { companyId, locationId, kioskDeviceId } = useDeviceStore.getState();
  const { eventLogId } = await outbox.enqueue({
    companyId,
    personId: input.employee.personId,
    eventType: input.eventType,
    locationId: locationId || undefined,
    kioskDevice: kioskDeviceId,
    geoLocation: getLastKnownGeo() ?? undefined,
    pin: input.pin,
    answers: input.answers,
    photoUri: input.photoUri,
  });

  recent.set(input.employee.personId, { eventLogId, at: now() });
  // The outbox holds the punch for the undo window; ask it to send just after.
  setTimeout(() => void outbox.drain(), UNDO_HOLD_MS + 250);
  return { eventLogId };
}
