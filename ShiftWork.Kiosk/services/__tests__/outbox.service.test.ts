import {
  Outbox, OutboxDeps, OutboxEntry, NewPunch, OutboxStorageError,
  UNDO_HOLD_MS, MAX_ENTRIES, MAX_AGE_MS, applyPendingStatus,
} from '../outbox.service';

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

function setup() {
  let clock = 1_000_000;
  let idSeq = 0;
  let stored: OutboxEntry[] = [];
  const deps: OutboxDeps & {
    clock: jest.Mock; uploadPhoto: jest.Mock; save: jest.Mock;
  } = {
    load: jest.fn(async () => stored),
    save: jest.fn(async (e: OutboxEntry[]) => { stored = e; }),
    uploadPhoto: jest.fn(async () => 'https://s3/photo.jpg'),
    clock: jest.fn(async () => ({})),
    now: () => clock,
    newId: () => `id-${++idSeq}`,
  };
  const outbox = new Outbox(deps);
  const advance = (ms: number) => { clock += ms; };
  const punch = (over: Partial<NewPunch> = {}): NewPunch => ({
    companyId: 'co-1', personId: 7, eventType: 'ClockIn', kioskDevice: 'kiosk-1', locationId: 3, ...over,
  });
  return { outbox, deps, advance, punch, getStored: () => stored, setStored: (e: OutboxEntry[]) => { stored = e; } };
}

describe('Outbox.enqueue / undo', () => {
  it('persists the punch with the real tap time and reports it as pending', async () => {
    const { outbox, punch, getStored } = setup();
    const { eventLogId, eventDate } = await outbox.enqueue(punch());
    expect(eventLogId).toBe('id-1');
    expect(eventDate).toBe(new Date(1_000_000).toISOString());
    expect(getStored()).toHaveLength(1);
    expect(outbox.getSnapshot().pendingCount).toBe(1);
  });

  it('undo inside the hold window removes the punch', async () => {
    const { outbox, punch, advance, getStored } = setup();
    const { eventLogId } = await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS - 1);
    expect(await outbox.undo(eventLogId)).toBe(true);
    expect(getStored()).toHaveLength(0);
    expect(outbox.getSnapshot().pendingCount).toBe(0);
  });

  it('undo after the hold window is refused', async () => {
    const { outbox, punch, advance } = setup();
    const { eventLogId } = await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS);
    expect(await outbox.undo(eventLogId)).toBe(false);
    expect(outbox.getSnapshot().pendingCount).toBe(1);
  });

  it('throws OutboxStorageError and keeps the queue unchanged when storage is full', async () => {
    const { outbox, punch, deps } = setup();
    deps.save.mockRejectedValueOnce(new Error('disk full'));
    await expect(outbox.enqueue(punch())).rejects.toBeInstanceOf(OutboxStorageError);
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });
});

describe('Outbox.drain', () => {
  it('does not send a punch before its undo window has passed', async () => {
    const { outbox, punch, deps } = setup();
    await outbox.enqueue(punch());
    await outbox.drain();
    expect(deps.clock).not.toHaveBeenCalled();
  });

  it('sends oldest first with the idempotency id and the real tap time, then removes the entry', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    advance(10);
    await outbox.enqueue(punch({ personId: 2, eventType: 'ClockOut', pin: '1234' }));
    advance(UNDO_HOLD_MS + 100);
    await outbox.drain();
    expect(deps.clock.mock.calls.map((c) => c[1].personId)).toEqual([1, 2]);
    expect(deps.clock.mock.calls[0][1]).toMatchObject({
      eventLogId: 'id-1', eventDate: new Date(1_000_000).toISOString(), kioskDevice: 'kiosk-1', locationId: 3,
    });
    expect(deps.clock.mock.calls[1][1].pin).toBe('1234');
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });

  it('a transient failure keeps the punch, backs off, and stops the queue to preserve order', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    await outbox.enqueue(punch({ personId: 2 }));
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(new Error('Network Error'));
    await outbox.drain();
    expect(deps.clock).toHaveBeenCalledTimes(1);
    expect(outbox.getSnapshot().pendingCount).toBe(2);

    await outbox.drain(); // still inside the backoff window
    expect(deps.clock).toHaveBeenCalledTimes(1);

    advance(61_000);
    await outbox.drain();
    expect(deps.clock.mock.calls.map((c) => c[1].personId)).toEqual([1, 1, 2]);
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });

  it('a 5xx is transient', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(httpError(503));
    await outbox.drain();
    expect(outbox.getSnapshot()).toMatchObject({ pendingCount: 1, failedCount: 0 });
  });

  it('a 4xx marks the punch failed, keeps it visible, and does not block the next one', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    await outbox.enqueue(punch({ personId: 2 }));
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(httpError(400));
    await outbox.drain();
    const snap = outbox.getSnapshot();
    expect(snap.failedCount).toBe(1);
    expect(snap.entries.find((e) => e.status === 'failed')?.personId).toBe(1);
    expect(deps.clock).toHaveBeenCalledTimes(2);
    expect(snap.entries).toHaveLength(1); // person 2 was sent and removed
  });

  it('uploads the photo first and sends the returned URL, not the local path', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ photoUri: 'file:///cache/p.jpg' }));
    advance(UNDO_HOLD_MS + 1);
    await outbox.drain();
    expect(deps.uploadPhoto).toHaveBeenCalledWith('co-1', 'file:///cache/p.jpg');
    expect(deps.clock.mock.calls[0][1].photoUrl).toBe('https://s3/photo.jpg');
  });

  it('a permanent photo failure still sends the punch, without a photo', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ photoUri: 'file:///gone.jpg' }));
    advance(UNDO_HOLD_MS + 1);
    deps.uploadPhoto.mockRejectedValueOnce(httpError(413));
    await outbox.drain();
    expect(deps.clock).toHaveBeenCalledTimes(1);
    expect(deps.clock.mock.calls[0][1].photoUrl).toBeUndefined();
  });

  it('a transient photo failure retries; after 5 attempts the punch goes without the photo', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ photoUri: 'file:///p.jpg' }));
    advance(UNDO_HOLD_MS + 1);
    deps.uploadPhoto.mockRejectedValue(new Error('Network Error'));
    for (let i = 0; i < 5; i++) {
      await outbox.drain();
      advance(61_000);
    }
    expect(deps.uploadPhoto).toHaveBeenCalledTimes(5);
    expect(deps.clock).toHaveBeenCalledTimes(1);
    expect(deps.clock.mock.calls[0][1].photoUrl).toBeUndefined();
  });

  it('a second drain while one is in flight does nothing (no out-of-order sends)', async () => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch({ personId: 1 }));
    await outbox.enqueue(punch({ personId: 2 }));
    advance(UNDO_HOLD_MS + 1);
    let release!: () => void;
    deps.clock.mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
    const first = outbox.drain();
    await new Promise((r) => setTimeout(r, 0));
    await outbox.drain(); // must return immediately, not send person 2 ahead of person 1
    expect(deps.clock).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(deps.clock.mock.calls.map((c) => c[1].personId)).toEqual([1, 2]);
  });

  it.each([408, 429])('a %i is transient: kept pending and retried, not failed', async (status) => {
    const { outbox, punch, deps, advance } = setup();
    await outbox.enqueue(punch());
    advance(UNDO_HOLD_MS + 1);
    deps.clock.mockRejectedValueOnce(httpError(status));
    await outbox.drain();
    expect(outbox.getSnapshot()).toMatchObject({ pendingCount: 1, failedCount: 0 });
    advance(61_000);
    await outbox.drain();
    expect(outbox.getSnapshot().entries).toHaveLength(0);
  });
});

describe('Outbox.init', () => {
  it('returns entries left "sending" by a crash to pending', async () => {
    const { outbox, setStored } = setup();
    setStored([{
      eventLogId: 'x', companyId: 'co-1', personId: 1, eventType: 'ClockIn', kioskDevice: 'k',
      eventDate: new Date(0).toISOString(), photoAttempts: 0, status: 'sending', holdUntil: 0,
      attempts: 0, nextAttemptAt: 0, createdAt: 0,
    }]);
    await outbox.init();
    expect(outbox.getSnapshot().entries[0].status).toBe('pending');
  });
});

describe('Outbox cap', () => {
  it('flags overCap past 200 punches', async () => {
    const { outbox, punch } = setup();
    for (let i = 0; i < MAX_ENTRIES + 1; i++) await outbox.enqueue(punch({ personId: i }));
    expect(outbox.getSnapshot().overCap).toBe(true);
    expect(outbox.getSnapshot().entries).toHaveLength(MAX_ENTRIES + 1); // nothing is dropped
  });

  it('flags overCap when the oldest punch is older than 24 hours', async () => {
    const { outbox, punch, advance } = setup();
    await outbox.enqueue(punch());
    expect(outbox.getSnapshot().overCap).toBe(false);
    advance(MAX_AGE_MS + 1);
    await outbox.enqueue(punch({ personId: 8 }));
    expect(outbox.getSnapshot().overCap).toBe(true);
  });
});

describe('applyPendingStatus', () => {
  const entry = (personId: number, eventType: 'ClockIn' | 'ClockOut', iso: string, status: OutboxEntry['status'] = 'pending'): OutboxEntry => ({
    eventLogId: `${personId}-${iso}`, companyId: 'c', personId, eventType, kioskDevice: 'k', eventDate: iso,
    photoAttempts: 0, status, holdUntil: 0, attempts: 0, nextAttemptAt: 0, createdAt: 0,
  });
  const employees = [
    { personId: 1, name: 'A', statusShiftWork: 'OffShift' },
    { personId: 2, name: 'B', statusShiftWork: 'OnShift' },
    { personId: 3, name: 'C', statusShiftWork: 'OffShift' },
  ];

  it('overlays unsent punches on the server status, latest punch wins', () => {
    const out = applyPendingStatus(employees, [
      entry(1, 'ClockIn', '2026-09-28T10:00:00.000Z'),
      entry(2, 'ClockOut', '2026-09-28T10:00:00.000Z'),
      entry(2, 'ClockIn', '2026-09-28T11:00:00.000Z'),
    ]);
    expect(out.map((e) => e.statusShiftWork)).toEqual(['OnShift', 'OnShift', 'OffShift']);
  });
  it('ignores failed punches and returns the same array when nothing is pending', () => {
    expect(applyPendingStatus(employees, [entry(1, 'ClockIn', '2026-09-28T10:00:00.000Z', 'failed')])).toBe(employees);
  });
});

describe('Outbox concurrency (saves that really yield)', () => {
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

  function slowSetup(delays: number[] = []) {
    const ctx = setup();
    let stored: OutboxEntry[] = [];
    ctx.deps.save.mockImplementation(async (e: OutboxEntry[]) => {
      await tick(delays.length ? (delays.shift() as number) : 2);
      stored = e;
    });
    return { ...ctx, getStored: () => stored };
  }
  const ids = (es: OutboxEntry[]) => es.map((e) => e.eventLogId);

  it('two concurrent enqueues both survive, in memory and in storage', async () => {
    const { outbox, punch, getStored } = slowSetup();
    await Promise.all([outbox.enqueue(punch({ personId: 1 })), outbox.enqueue(punch({ personId: 2 }))]);
    expect(ids(outbox.getSnapshot().entries)).toEqual(['id-1', 'id-2']);
    expect(ids(getStored())).toEqual(['id-1', 'id-2']);
  });

  it('undo while a later enqueue is saving keeps the undone punch gone', async () => {
    const { outbox, punch, getStored } = slowSetup();
    const { eventLogId: id1 } = await outbox.enqueue(punch({ personId: 1 }));
    const p2 = outbox.enqueue(punch({ personId: 2 }));
    expect(await outbox.undo(id1)).toBe(true);
    await p2;
    expect(ids(outbox.getSnapshot().entries)).toEqual(['id-2']);
    expect(ids(getStored())).toEqual(['id-2']);
  });

  it('an enqueue during a drain does not resurrect the punch that was just sent', async () => {
    const { outbox, punch, deps, advance, getStored } = slowSetup();
    await outbox.enqueue(punch({ personId: 1 }));
    advance(UNDO_HOLD_MS + 1);
    let release!: () => void;
    deps.clock.mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
    const draining = outbox.drain();
    await tick(5);
    const p2 = outbox.enqueue(punch({ personId: 2 }));
    release();
    await Promise.all([draining, p2]);
    const snap = outbox.getSnapshot();
    expect(snap.entries.map((e) => [e.eventLogId, e.status])).toEqual([['id-2', 'pending']]);
    expect(ids(getStored())).toEqual(['id-2']);
  });

  it('saves land in order: a slow older save cannot overwrite a newer one', async () => {
    const { outbox, punch, getStored } = slowSetup([30, 1]);
    await Promise.all([outbox.enqueue(punch({ personId: 1 })), outbox.enqueue(punch({ personId: 2 })), tick(60)]);
    expect(ids(getStored())).toEqual(ids(outbox.getSnapshot().entries));
    expect(getStored()).toHaveLength(2);
  });

  it('a failed save does not poison later saves, and only the failed enqueue is rolled back', async () => {
    const { outbox, punch, deps, getStored } = slowSetup();
    const real = deps.save.getMockImplementation() as (e: OutboxEntry[]) => Promise<void>;
    deps.save.mockImplementationOnce(async () => { throw new Error('disk full'); });
    const failing = outbox.enqueue(punch({ personId: 1 }));
    await expect(failing).rejects.toBeInstanceOf(OutboxStorageError);
    deps.save.mockImplementation(real);
    await outbox.enqueue(punch({ personId: 2 }));
    expect(ids(outbox.getSnapshot().entries)).toEqual(['id-2']);
    expect(ids(getStored())).toEqual(['id-2']);
  });
});
