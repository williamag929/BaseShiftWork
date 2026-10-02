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
import { useLineup, useLineupCommit, lineupKey } from '../useLineup';

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

  it('sends once when called twice in the same tick', async () => {
    seed();
    let resolve!: (v: unknown) => void;
    mockCommit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLineupCommit(), { wrapper });
    let p1: Promise<unknown>;
    await act(async () => {
      p1 = result.current.commit();
      result.current.commit();
    });
    expect(mockCommit).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ results: [] });
      await p1;
    });
    expect(mockCommit).toHaveBeenCalledTimes(1);
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
      await expect(result.current.commit()).rejects.toThrow(Error);
    });
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
