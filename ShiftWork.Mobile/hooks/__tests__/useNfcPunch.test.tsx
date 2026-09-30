jest.mock('@/services/nfc-punch.service', () => ({ nfcPunchService: { punch: jest.fn() } }));
jest.mock('@/utils', () => ({
  getQuickLocation: jest.fn(),
  saveActiveClockInAt: jest.fn().mockResolvedValue(undefined),
  clearActiveClockInAt: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/hooks/queries', () => ({
  shiftEventsKey: (companyId: string, personId: number) => ['shiftEvents', companyId, personId],
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { nfcPunchService } from '@/services/nfc-punch.service';
import { getQuickLocation, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { classifyNfcPunchError, useNfcPunch } from '../useNfcPunch';

const punchMock = nfcPunchService.punch as jest.Mock;
const uuidMock = Crypto.randomUUID as jest.Mock;
const result = (over: Partial<Record<string, unknown>> = {}) => ({
  eventLogId: 'id-1', eventType: 'clockin', eventDate: '2026-09-30T12:00:00Z', locationId: 10,
  locationName: 'North Tower', geofenceStatus: 'Inside', repeated: false, ...over,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['shiftEvents', 'co', 1], []);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNfcPunch('co', 1), { wrapper });
  return { client, hook };
}

beforeEach(() => {
  jest.clearAllMocks();
  // mockReset, not just clear: leftover *Once values would leak between tests.
  punchMock.mockReset();
  usePendingTagStore.getState().setTagKey(null);
  uuidMock.mockReset();
  (getQuickLocation as jest.Mock).mockResolvedValue('1,2');
  uuidMock.mockReturnValueOnce('uuid-A').mockReturnValueOnce('uuid-B');
});

it('punches, shows success, and records the clock-in locally', async () => {
  punchMock.mockResolvedValue(result());
  const { client, hook } = setup();

  await act(() => hook.result.current.punch('KEY'));

  expect(punchMock).toHaveBeenCalledWith('co', expect.objectContaining({
    tagKey: 'KEY', eventLogId: 'uuid-A', geoLocation: '1,2', device: 'Pixel 8',
  }));
  expect(hook.result.current.state).toEqual({ status: 'success', result: result() });
  expect(saveActiveClockInAt).toHaveBeenCalledWith(new Date('2026-09-30T12:00:00Z').toISOString());
  expect(client.getQueryData<unknown[]>(['shiftEvents', 'co', 1])).toHaveLength(1);
});

it('clears the local clock-in after a clock-out', async () => {
  punchMock.mockResolvedValue(result({ eventType: 'clockout' }));
  const { hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(clearActiveClockInAt).toHaveBeenCalled();
});

it('does not add a repeated tap to the event list', async () => {
  punchMock.mockResolvedValue(result({ repeated: true }));
  const { client, hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(client.getQueryData<unknown[]>(['shiftEvents', 'co', 1])).toHaveLength(0);
});

it('posts without geoLocation when there is no fix', async () => {
  (getQuickLocation as jest.Mock).mockResolvedValue(null);
  punchMock.mockResolvedValue(result({ geofenceStatus: 'Unknown' }));
  const { hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(punchMock.mock.calls[0][1].geoLocation).toBeUndefined();
  expect(hook.result.current.state.status).toBe('success');
});

it('retry reuses the eventLogId and tap time; reset starts a new punch', async () => {
  punchMock.mockRejectedValueOnce({ statusCode: 0, message: 'Network error' });
  const { hook } = setup();

  await act(() => hook.result.current.punch('KEY'));
  expect(hook.result.current.state).toEqual({ status: 'error', kind: 'offline', message: 'Network error' });

  punchMock.mockResolvedValueOnce(result());
  await act(() => hook.result.current.punch('KEY'));
  expect(punchMock.mock.calls[1][1].eventLogId).toBe('uuid-A');
  expect(punchMock.mock.calls[1][1].eventDate).toBe(punchMock.mock.calls[0][1].eventDate);

  act(() => hook.result.current.reset());
  punchMock.mockResolvedValueOnce(result());
  await act(() => hook.result.current.punch('KEY'));
  expect(punchMock.mock.calls[2][1].eventLogId).toBe('uuid-B');
});

it('ignores a second punch while one is in flight', async () => {
  let resolve!: (v: unknown) => void;
  punchMock.mockReturnValue(new Promise((r) => { resolve = r; }));
  const { hook } = setup();

  let first!: Promise<void>;
  act(() => { first = hook.result.current.punch('KEY'); });
  await act(() => hook.result.current.punch('KEY'));
  resolve(result());
  await act(() => first);

  expect(punchMock).toHaveBeenCalledTimes(1);
});

it('a reset during the GPS wait does not crash the in-flight punch', async () => {
  let resolveGps!: (v: string | null) => void;
  (getQuickLocation as jest.Mock).mockReturnValue(new Promise((r) => { resolveGps = r; }));
  punchMock.mockResolvedValue(result());
  const { hook } = setup();

  let first!: Promise<void>;
  act(() => { first = hook.result.current.punch('KEY'); });
  act(() => hook.result.current.reset());
  resolveGps('1,2');
  await act(() => first);

  expect(punchMock.mock.calls[0][1].eventLogId).toBe('uuid-A');
  expect(hook.result.current.state.status).toBe('success');
});

it('keeps the tag key for after sign-in when the token is expired (401)', async () => {
  punchMock.mockRejectedValue({ statusCode: 401, message: 'Unauthorized' });
  const { hook } = setup();
  await act(() => hook.result.current.punch('KEY'));
  expect(hook.result.current.state).toMatchObject({ status: 'error', kind: 'signed_out' });
  expect(usePendingTagStore.getState().tagKey).toBe('KEY');
});

describe('classifyNfcPunchError', () => {
  it.each([
    [{ statusCode: 0 }, 'offline'],
    [{ statusCode: 404 }, 'unknown_tag'],
    [{ statusCode: 401 }, 'signed_out'],
    [{ statusCode: 400 }, 'rejected'],
    [{ statusCode: 403 }, 'rejected'],
    [{ statusCode: 409 }, 'failed'],
    [new Error('x'), 'failed'],
    [undefined, 'failed'],
  ])('%p → %s', (err, kind) => {
    expect(classifyNfcPunchError(err)).toBe(kind);
  });
});
