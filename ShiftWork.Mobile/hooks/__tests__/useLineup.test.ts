jest.mock('firebase/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('@/utils/storage.utils', () => ({
  clearAllStorage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/notification.service', () => ({ notificationService: { removeDeviceToken: jest.fn() } }));
jest.mock('@/services/lineup.service', () => ({
  lineupService: { getLineup: jest.fn(), commit: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useLineupDraftStore } from '../../store/lineupDraftStore';
import { lineupService } from '@/services/lineup.service';
import { useLineup, useLineupCommit, lineupKey, shouldRetryLineup, resetLineupCommitGuard } from '../useLineup';

const mockGet = lineupService.getLineup as jest.Mock;
const mockCommit = lineupService.commit as jest.Mock;

const shift = { start: '07:00', end: '15:30', areaId: null };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ companyId: 'co-1' });
  useLineupDraftStore.getState().clear();
  resetLineupCommitGuard();
});

describe('useLineup', () => {
  it('fetches the lineup for the company and date', async () => {
    const data = { date: '2026-10-01', locations: [] };
    mockGet.mockResolvedValue(data);
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineup('2026-10-01'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(mockGet).toHaveBeenCalledWith('co-1', '2026-10-01');
  });

  it('builds the query key', () => {
    expect(lineupKey('co-1', '2026-10-01')).toEqual(['lineup', 'co-1', '2026-10-01']);
  });
});

describe('useLineupCommit', () => {
  const seed = () => {
    const s = useLineupDraftStore.getState();
    s.setDate('2026-10-01');
    s.assign(7, 3, shift);
  };

  it('sends the store draft, applies results and invalidates lineup queries', async () => {
    seed();
    mockCommit.mockResolvedValue({
      results: [{ status: 'created', personId: 7, locationId: 3, shiftId: 99, errors: [], warnings: [] }],
    });
    const { client, wrapper } = setup();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    await act(async () => {
      await result.current.commit();
    });
    expect(mockCommit).toHaveBeenCalledWith('co-1', {
      date: '2026-10-01',
      assignments: [{ personId: 7, locationId: 3, areaId: null, start: '07:00', end: '15:30', acceptWarnings: false }],
      removals: [],
    });
    expect(useLineupDraftStore.getState().assignments).toEqual([]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['lineup', 'co-1'] });
  });

  it('returns the same response to both same-tick calls and sends once', async () => {
    seed();
    let resolve!: (v: unknown) => void;
    mockCommit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    await act(async () => {
      p1 = result.current.commit();
      p2 = result.current.commit();
    });
    expect(mockCommit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    const response = { results: [] };
    await act(async () => {
      resolve(response);
      await p1;
    });
    expect(await p1).toBe(response);
    expect(await p2).toBe(response);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('populates results after success and reset clears them', async () => {
    seed();
    const r = { status: 'rejected', personId: 7, locationId: 3, errors: ['x'], warnings: [] };
    mockCommit.mockResolvedValue({ results: [r] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    expect(result.current.results).toBeNull();
    await act(async () => { await result.current.commit(); });
    await waitFor(() => expect(result.current.results).toEqual([r]));
    act(() => result.current.reset());
    await waitFor(() => expect(result.current.results).toBeNull());
  });

  it('does not apply results to a different date than the one sent', async () => {
    seed();
    let resolve!: (v: unknown) => void;
    mockCommit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    let p!: Promise<unknown>;
    await act(async () => { p = result.current.commit(); });
    act(() => {
      const s = useLineupDraftStore.getState();
      s.setDate('2026-10-02');
      s.assign(7, 3, shift);
    });
    await act(async () => {
      resolve({ results: [{ status: 'created', personId: 7, locationId: 3, shiftId: 1, errors: [], warnings: [] }] });
      await p;
    });
    expect(useLineupDraftStore.getState().date).toBe('2026-10-02');
    expect(useLineupDraftStore.getState().assignments).toHaveLength(1);
  });

  it('invalidates lineup queries even when the commit fails', async () => {
    seed();
    mockCommit.mockRejectedValue(new Error('timeout'));
    const { client, wrapper } = setup();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    await act(async () => { await expect(result.current.commit()).rejects.toThrow('timeout'); });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['lineup', 'co-1'] });
  });

  it('a remounted hook cannot start a second request while one is in flight', async () => {
    seed();
    let resolve!: (v: unknown) => void;
    mockCommit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = setup();
    const first = renderHook(() => useLineupCommit(), { wrapper });
    let p1!: Promise<unknown>;
    await act(async () => { p1 = first.result.current.commit(); });
    first.unmount();
    const second = renderHook(() => useLineupCommit(), { wrapper });
    let p2!: Promise<unknown>;
    await act(async () => { p2 = second.result.current.commit(); });
    expect(mockCommit).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ results: [] }); await Promise.all([p1, p2]); });
  });

  it('keeps the draft and rejects when the commit fails', async () => {
    seed();
    mockCommit.mockRejectedValue(new Error('boom'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    await act(async () => {
      await expect(result.current.commit()).rejects.toThrow('boom');
    });
    expect(useLineupDraftStore.getState().assignments).toHaveLength(1);
    await act(async () => {
      await expect(result.current.commit()).rejects.toThrow('boom');
    });
    expect(mockCommit).toHaveBeenCalledTimes(2);
  });

  it('rejects without calling the service when the store date is null', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    await act(async () => {
      await expect(result.current.commit()).rejects.toThrow('No lineup date selected');
    });
    expect(mockCommit).not.toHaveBeenCalled();
  });
});

describe('useLineup retry rule', () => {
  it('does not retry 403 but retries 500 up to 3 times', () => {
    expect(shouldRetryLineup(0, { statusCode: 403 })).toBe(false);
    expect(shouldRetryLineup(0, { response: { status: 403 } })).toBe(false);
    expect(shouldRetryLineup(0, { statusCode: 500 })).toBe(true);
    expect(shouldRetryLineup(2, { statusCode: 500 })).toBe(true);
    expect(shouldRetryLineup(3, { statusCode: 500 })).toBe(false);
  });

  it('calls the service once for a 403', async () => {
    mockGet.mockRejectedValue({ statusCode: 403 });
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineup('2026-10-01'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
