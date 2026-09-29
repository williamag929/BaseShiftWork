import type { ClockEventType, KioskAnswer, KioskClockRequest, KioskEmployee } from '@/types';

export const MAX_ENTRIES = 200;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const UNDO_HOLD_MS = 3_000;
const MAX_PHOTO_ATTEMPTS = 5;

export interface OutboxEntry {
  eventLogId: string;
  companyId: string;
  personId: number;
  eventType: ClockEventType;
  locationId?: number;
  kioskDevice: string;
  /** ISO timestamp of the real tap. */
  eventDate: string;
  geoLocation?: string;
  pin?: string;
  answers?: KioskAnswer[];
  photoUri?: string;
  photoUrl?: string;
  photoFailed?: boolean;
  photoAttempts: number;
  status: 'pending' | 'sending' | 'failed';
  /** Epoch ms. The entry is not sent before this (Undo window). */
  holdUntil: number;
  attempts: number;
  /** Epoch ms. Backoff gate after a transient failure. */
  nextAttemptAt: number;
  lastError?: string;
  createdAt: number;
}

export type NewPunch = Pick<
  OutboxEntry,
  'companyId' | 'personId' | 'eventType' | 'locationId' | 'kioskDevice' | 'geoLocation' | 'pin' | 'answers' | 'photoUri'
>;

export interface OutboxDeps {
  load(): Promise<OutboxEntry[]>;
  save(entries: OutboxEntry[]): Promise<void>;
  uploadPhoto(companyId: string, uri: string): Promise<string>;
  clock(companyId: string, request: KioskClockRequest): Promise<unknown>;
  now(): number;
  newId(): string;
}

export interface OutboxSnapshot {
  entries: OutboxEntry[];
  pendingCount: number;
  failedCount: number;
  /** True when the queue holds more than MAX_ENTRIES or an entry older than MAX_AGE_MS. */
  overCap: boolean;
}

/** Milliseconds left in an entry's Undo window (0 when closed or unknown). */
export function undoRemainingMs(entry: { holdUntil: number } | undefined, now: number): number {
  return entry ? Math.max(0, entry.holdUntil - now) : 0;
}

export class OutboxStorageError extends Error {
  constructor(message = 'Could not save the punch on this device') {
    super(message);
    this.name = 'OutboxStorageError';
  }
}

/** 4xx (except 408/429) will never succeed on retry; everything else is transient. */
export function isPermanentError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export class Outbox {
  private entries: OutboxEntry[] = [];
  private listeners = new Set<() => void>();
  private draining = false;
  /** Every save goes through this chain so an older, slower save can never land after a newer one. */
  private saveChain: Promise<void> = Promise.resolve();
  private snapshot: OutboxSnapshot = { entries: [], pendingCount: 0, failedCount: 0, overCap: false };

  constructor(private readonly deps: OutboxDeps) {}

  /** Load persisted entries; anything left "sending" by a crash goes back to pending. */
  async init(): Promise<void> {
    const loaded = await this.deps.load();
    this.entries = loaded.map((e) => (e.status === 'sending' ? { ...e, status: 'pending' as const } : e));
    this.publish();
  }

  async enqueue(punch: NewPunch): Promise<{ eventLogId: string; eventDate: string }> {
    const now = this.deps.now();
    const entry: OutboxEntry = {
      ...punch,
      eventLogId: this.deps.newId(),
      eventDate: new Date(now).toISOString(),
      photoAttempts: 0,
      status: 'pending',
      holdUntil: now + UNDO_HOLD_MS,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: now,
    };
    // Added synchronously so concurrent enqueue/undo/drain never work from a stale copy.
    this.entries = [...this.entries, entry];
    this.publish();
    try {
      await this.save();
    } catch {
      this.entries = this.entries.filter((e) => e.eventLogId !== entry.eventLogId);
      this.publish();
      throw new OutboxStorageError();
    }
    return { eventLogId: entry.eventLogId, eventDate: entry.eventDate };
  }

  /** Removes the punch if it is still inside its Undo window and unsent. */
  async undo(eventLogId: string): Promise<boolean> {
    const entry = this.entries.find((e) => e.eventLogId === eventLogId);
    if (!entry || entry.status !== 'pending' || this.deps.now() >= entry.holdUntil) return false;
    this.entries = this.entries.filter((e) => e.eventLogId !== eventLogId);
    await this.persist();
    this.publish();
    return true;
  }

  /** Sends due entries oldest first. Stops at the first transient failure to keep order. */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (const id of this.entries.map((e) => e.eventLogId)) {
        const entry = this.entries.find((e) => e.eventLogId === id);
        if (!entry || entry.status !== 'pending') continue;
        const now = this.deps.now();
        // Not due yet: everything behind it is newer, so wait too. This keeps punches in order.
        if (now < entry.holdUntil || now < entry.nextAttemptAt) break;
        const ok = await this.sendOne(entry);
        if (!ok) break;
      }
    } finally {
      this.draining = false;
    }
  }

  /** Re-evaluates clock-dependent state (overCap); notifies subscribers only if it changed. */
  refresh(): void {
    const before = this.snapshot;
    this.publish(false);
    if (this.snapshot.overCap !== before.overCap) this.listeners.forEach((l) => l());
    else this.snapshot = before;
  }

  getSnapshot(): OutboxSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Returns false when a transient failure means the rest of the queue should wait. */
  private async sendOne(entry: OutboxEntry): Promise<boolean> {
    this.patch(entry.eventLogId, { status: 'sending' });
    let photoUrl = entry.photoUrl;
    let photoFailed = entry.photoFailed ?? false;

    if (entry.photoUri && !photoUrl && !photoFailed) {
      try {
        photoUrl = await this.deps.uploadPhoto(entry.companyId, entry.photoUri);
        this.patch(entry.eventLogId, { photoUrl });
      } catch (err) {
        const attempts = entry.photoAttempts + 1;
        if (isPermanentError(err) || attempts >= MAX_PHOTO_ATTEMPTS) {
          photoFailed = true; // give up on the photo; never lose the time record
          this.patch(entry.eventLogId, { photoFailed: true, photoAttempts: attempts });
        } else {
          this.retryLater(entry, err, { photoAttempts: attempts });
          await this.persist();
          return false;
        }
      }
    }

    try {
      await this.deps.clock(entry.companyId, {
        personId: entry.personId,
        eventType: entry.eventType,
        locationId: entry.locationId,
        kioskDevice: entry.kioskDevice,
        geoLocation: entry.geoLocation,
        answers: entry.answers,
        pin: entry.pin,
        eventLogId: entry.eventLogId,
        eventDate: entry.eventDate,
        photoUrl: photoFailed ? undefined : photoUrl,
      });
      this.entries = this.entries.filter((e) => e.eventLogId !== entry.eventLogId);
      await this.persist();
      this.publish();
      return true;
    } catch (err) {
      if (isPermanentError(err)) {
        this.patch(entry.eventLogId, { status: 'failed', lastError: errorMessage(err) });
        await this.persist();
        return true; // a permanently failed punch must not block the ones behind it
      }
      this.retryLater(entry, err, {});
      await this.persist();
      return false;
    }
  }

  private retryLater(entry: OutboxEntry, err: unknown, extra: Partial<OutboxEntry>): void {
    const attempts = entry.attempts + 1;
    const backoff = Math.min(60_000, 2_000 * 2 ** attempts);
    this.patch(entry.eventLogId, {
      ...extra,
      status: 'pending',
      attempts,
      nextAttemptAt: this.deps.now() + backoff,
      lastError: errorMessage(err),
    });
  }

  private patch(eventLogId: string, changes: Partial<OutboxEntry>): void {
    this.entries = this.entries.map((e) => (e.eventLogId === eventLogId ? { ...e, ...changes } : e));
    this.publish();
  }

  /** Queues a save of the latest entries; rejects if this save fails, later saves are unaffected. */
  private save(): Promise<void> {
    const run = this.saveChain.then(() => this.deps.save(this.entries));
    this.saveChain = run.catch(() => undefined);
    return run;
  }

  private async persist(): Promise<void> {
    try {
      await this.save();
    } catch {
      // The in-memory queue is still correct; the next successful save catches up.
    }
  }

  private publish(notify = true): void {
    const now = this.deps.now();
    const oldest = this.entries.reduce((min, e) => Math.min(min, e.createdAt), Infinity);
    this.snapshot = {
      entries: this.entries,
      pendingCount: this.entries.filter((e) => e.status !== 'failed').length,
      failedCount: this.entries.filter((e) => e.status === 'failed').length,
      overCap: this.entries.length > MAX_ENTRIES || (this.entries.length > 0 && now - oldest > MAX_AGE_MS),
    };
    if (notify) this.listeners.forEach((l) => l());
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Server status for each person, with unsent local punches applied on top. */
export function applyPendingStatus(employees: KioskEmployee[], entries: OutboxEntry[]): KioskEmployee[] {
  const latest = new Map<number, OutboxEntry>();
  for (const e of entries) {
    if (e.status === 'failed') continue;
    const cur = latest.get(e.personId);
    if (!cur || e.eventDate > cur.eventDate) latest.set(e.personId, e);
  }
  if (latest.size === 0) return employees;
  return employees.map((emp) => {
    const e = latest.get(emp.personId);
    return e ? { ...emp, statusShiftWork: e.eventType === 'ClockIn' ? 'OnShift' : 'OffShift' } : emp;
  });
}
