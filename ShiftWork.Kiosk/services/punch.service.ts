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
const recent = new Map<number, { promise: Promise<{ eventLogId: string }>; at: number }>();

/** Call after Undo so the employee can punch again right away. */
export function forgetRecentPunch(personId: number): void {
  recent.delete(personId);
}

/** Records the punch on this tablet (it is sent in the background) and returns its id. */
export async function commitPunch(
  input: CommitInput,
  now: () => number = Date.now
): Promise<{ eventLogId: string }> {
  const personId = input.employee.personId;
  const prior = recent.get(personId);
  if (prior && now() - prior.at < UNDO_HOLD_MS) return prior.promise;

  // Store the in-flight promise before awaiting so overlapping calls share one enqueue.
  const promise = enqueueAndSchedule(input);
  const entry = { promise, at: now() };
  recent.set(personId, entry);
  promise.catch(() => {
    if (recent.get(personId) === entry) recent.delete(personId);
  });
  return promise;
}

async function enqueueAndSchedule(input: CommitInput): Promise<{ eventLogId: string }> {
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
  // The outbox holds the punch for the undo window; ask it to send just after.
  setTimeout(() => void outbox.drain(), UNDO_HOLD_MS + 250);
  return { eventLogId };
}
