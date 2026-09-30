jest.mock('../outbox', () => ({
  outbox: { enqueue: jest.fn(), drain: jest.fn() },
}));
jest.mock('../geo.service', () => ({
  getLastKnownGeo: jest.fn(),
}));
jest.mock('@/store/deviceStore', () => ({
  useDeviceStore: {
    getState: () => ({ companyId: 'co-1', locationId: 3, kioskDeviceId: 'kiosk-1' }),
  },
}));

import { outbox } from '../outbox';
import { getLastKnownGeo } from '../geo.service';
import { UNDO_HOLD_MS } from '../outbox.service';
import { commitPunch, forgetRecentPunch } from '../punch.service';

const enqueue = outbox.enqueue as jest.Mock;
const drain = outbox.drain as jest.Mock;
const geo = getLastKnownGeo as jest.Mock;

const ana = { personId: 7, name: 'Ana' };
const ben = { personId: 8, name: 'Ben' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  let n = 0;
  enqueue.mockImplementation(async () => ({ eventLogId: `e${++n}`, eventDate: 'x' }));
  geo.mockReturnValue('40.1,-73.9');
  forgetRecentPunch(7);
  forgetRecentPunch(8);
});
afterEach(() => jest.useRealTimers());

describe('commitPunch', () => {
  it('records the punch with the device, last known location, pin, photo and answers', async () => {
    const answers = [{ kioskQuestionId: 1, answerText: 'yes' }];

    const result = await commitPunch({
      employee: ana, eventType: 'ClockOut', pin: '1234', photoUri: 'file:///p.jpg', answers,
    });

    expect(result.eventLogId).toBe('e1');
    expect(enqueue).toHaveBeenCalledWith({
      companyId: 'co-1',
      personId: 7,
      eventType: 'ClockOut',
      locationId: 3,
      kioskDevice: 'kiosk-1',
      geoLocation: '40.1,-73.9',
      pin: '1234',
      answers,
      photoUri: 'file:///p.jpg',
    });
  });

  it('leaves out the location and pin when there are none', async () => {
    geo.mockReturnValue(null);

    await commitPunch({ employee: ana, eventType: 'ClockIn' });

    const call = enqueue.mock.calls[0][0];
    expect(call.geoLocation).toBeUndefined();
    expect(call.pin).toBeUndefined();
    expect(call.photoUri).toBeUndefined();
  });

  it('asks the outbox to send shortly after the undo window closes', async () => {
    await commitPunch({ employee: ana, eventType: 'ClockIn' });
    expect(drain).not.toHaveBeenCalled();

    jest.advanceTimersByTime(UNDO_HOLD_MS + 300);

    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('a double tap inside the undo window records one punch and returns the same id', async () => {
    let t = 1_000;
    const first = await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    t += 500;
    const second = await commitPunch({ employee: ana, eventType: 'ClockOut' }, () => t);

    expect(second.eventLogId).toBe(first.eventLogId);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('a different person is never blocked by someone else\'s recent punch', async () => {
    let t = 1_000;
    await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    await commitPunch({ employee: ben, eventType: 'ClockIn' }, () => t);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('a deliberate second punch after the undo window is recorded', async () => {
    let t = 1_000;
    await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    t += UNDO_HOLD_MS;
    await commitPunch({ employee: ana, eventType: 'ClockOut' }, () => t);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('after Undo the same person can punch again immediately', async () => {
    let t = 1_000;
    await commitPunch({ employee: ana, eventType: 'ClockIn' }, () => t);
    forgetRecentPunch(7);
    t += 200;
    await commitPunch({ employee: ana, eventType: 'ClockOut' }, () => t);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('two overlapping calls for the same person record one punch and share the id', async () => {
    const [a, b] = await Promise.all([
      commitPunch({ employee: ana, eventType: 'ClockIn' }),
      commitPunch({ employee: ana, eventType: 'ClockIn' }),
    ]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(a.eventLogId).toBe(b.eventLogId);
  });

  it('a failed enqueue does not block a retry', async () => {
    enqueue.mockRejectedValueOnce(new Error('disk full'));
    await expect(commitPunch({ employee: ana, eventType: 'ClockIn' })).rejects.toThrow();
    await commitPunch({ employee: ana, eventType: 'ClockIn' });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
});
