jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  return { useFocusEffect: (cb: () => void) => { React.useEffect(() => cb(), []); } }; // eslint-disable-line
});
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('@/services/lineup.service', () => ({
  lineupService: { commit: jest.fn(), getLineup: jest.fn() },
}));
jest.mock('@/hooks/useLineup', () => ({ ...jest.requireActual('@/hooks/useLineup'), useLineup: jest.fn() }));
jest.mock('@/hooks/usePermission', () => ({ usePermission: jest.fn() }));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import LineupScreen from '../../app/(tabs)/lineup';
import { CommitBar } from '../screens/lineup/CommitBar';
import { ResultsSheet } from '../screens/lineup/ResultsSheet';
import { LocaleProvider } from '@/i18n';
import { useLineup, resetLineupCommitGuard } from '@/hooks/useLineup';
import { usePermission } from '@/hooks/usePermission';
import { lineupService } from '@/services/lineup.service';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import type { Lineup, LineupCommitResult } from '@/types/lineup';

const mockUseLineup = useLineup as jest.Mock;
const mockPerm = usePermission as jest.Mock;
const mockCommit = lineupService.commit as jest.Mock;
const mockNet = Network.getNetworkStateAsync as jest.Mock;

const shift = { start: '07:00', end: '15:00', areaId: null };
const lineup = (): Lineup => ({
  date: '2026-10-02',
  timeZone: 'America/New_York',
  canEdit: true,
  locations: [
    {
      locationId: 7, name: 'Site Seven', defaultShift: shift,
      shifts: [{ shiftId: 502, personId: 5, name: 'Ana Ruiz', start: '2026-10-02T07:00:00Z', end: '2026-10-02T15:00:00Z', status: 'Scheduled' }],
    },
  ],
  bench: [
    { personId: 41, name: 'Luis Vega', crewIds: [1] },
    { personId: 44, name: 'Dan Cho', crewIds: [1] },
    { personId: 52, name: 'Mia Soto', crewIds: [1] },
  ],
  unavailable: [],
  crews: [{ crewId: 1, name: 'Framing', memberIds: [41, 44, 52] }],
});
const res = (r: Partial<LineupCommitResult> & { status: LineupCommitResult['status'] }): LineupCommitResult =>
  ({ errors: [], warnings: [], ...r });

const store = () => useLineupDraftStore.getState();
const toasts = () => useToastStore.getState().toasts.map((x) => x.message);
const ui = () => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <LocaleProvider><LineupScreen /></LocaleProvider>
  </QueryClientProvider>
);
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  resetLineupCommitGuard();
  store().clear();
  useToastStore.getState().dismissAll();
  useAuthStore.setState({ companyId: 'c1' });
  mockPerm.mockImplementation((k: string) => k === 'lineup.edit');
  mockUseLineup.mockReturnValue({ data: lineup(), isLoading: false, isError: false, error: null, refetch: jest.fn() });
  mockNet.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});

describe('CommitBar', () => {
  it('renders nothing when count is 0', () => {
    const { toJSON } = render(<LocaleProvider><CommitBar count={0} pending={false} offline={false} onCommit={jest.fn()} /></LocaleProvider>);
    expect(toJSON()).toBeNull();
  });

  it('shows the label with the count and fires onCommit', () => {
    const onCommit = jest.fn();
    const { getByText } = render(<LocaleProvider><CommitBar count={3} pending={false} offline={false} onCommit={onCommit} /></LocaleProvider>);
    fireEvent.press(getByText('Publish 3 changes'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it.each([['pending', { pending: true, offline: false }], ['offline', { pending: false, offline: true }]])(
    'is a no-op while %s',
    (_n, p) => {
      const onCommit = jest.fn();
      const { getByTestId } = render(<LocaleProvider><CommitBar count={3} onCommit={onCommit} {...p} /></LocaleProvider>);
      fireEvent.press(getByTestId('commit-button'));
      expect(onCommit).not.toHaveBeenCalled();
    },
  );
});

describe('ResultsSheet', () => {
  it('lists rejections, warnings (with confirm) and a rejected removal with a fallback label', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <LocaleProvider>
        <ResultsSheet
          results={[
            res({ status: 'created', personId: 41, locationId: 7 }),
            res({ status: 'rejected', personId: 44, errors: ['Overlaps an existing shift'] }),
            res({ status: 'needs-confirmation', personId: 52, warnings: ['Exceeds weekly hours limit'] }),
            res({ status: 'rejected', shiftId: 502, errors: ['Shift not found.'] }),
          ]}
          nameFor={(id) => ({ 44: 'Dan Cho', 52: 'Mia Soto' } as Record<number, string>)[id] ?? ''}
          shiftNameFor={() => ''}
          onConfirm={onConfirm}
          onClose={jest.fn()}
        />
      </LocaleProvider>,
    );
    expect(getByText('1 added')).toBeTruthy();
    expect(getByText('Overlaps an existing shift')).toBeTruthy();
    expect(getByText('Exceeds weekly hours limit')).toBeTruthy();
    expect(getByText('Shift not found.')).toBeTruthy();
    expect(getByText('Shift #502')).toBeTruthy();
    fireEvent.press(getByTestId('confirm-52'));
    expect(onConfirm).toHaveBeenCalledWith([52]);
  });
});

describe('Lineup commit flow', () => {
  const draftOne = (fire: typeof fireEvent, getByTestId: (id: string) => any) => fire.press(getByTestId('bench-chip-41'));

  it('ignores a second publish press while pending (one service call)', async () => {
    let resolve!: (v: unknown) => void;
    mockCommit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { getByTestId, findByTestId } = render(ui());
    draftOne(fireEvent, getByTestId);
    const btn = await findByTestId('commit-button');
    fireEvent.press(btn);
    fireEvent.press(getByTestId('commit-button'));
    await flush();
    expect(mockCommit).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ results: [res({ status: 'created', personId: 41, locationId: 7 })] }); });
  });

  it('disables all draft edits while a commit is pending', async () => {
    let resolve!: (v: unknown) => void;
    mockCommit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { getByTestId, queryByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    fireEvent.press(getByTestId('commit-button'));
    await flush();
    // Bench chip 44 is no longer pressable, drafted chip cannot be undone, date arrows are inert.
    fireEvent.press(getByTestId('bench-chip-44'));
    fireEvent.press(getByTestId('drafted-chip-41'));
    const dateBefore = store().date;
    fireEvent.press(getByTestId('lineup-next-day'));
    fireEvent.press(getByTestId('saved-chip-502'));
    expect(store().assignments.map((a) => a.personId)).toEqual([41]);
    expect(store().removals).toEqual([]);
    expect(store().date).toBe(dateBefore);
    expect(queryByTestId('add-crew-7')).toBeNull();
    await act(async () => { resolve({ results: [res({ status: 'created', personId: 41, locationId: 7 })] }); });
  });

  it('shows results, keeps rejected/needs-confirmation in the draft and drops created', async () => {
    mockCommit.mockResolvedValue({
      results: [
        res({ status: 'created', personId: 41, locationId: 7 }),
        res({ status: 'rejected', personId: 44, locationId: 7, errors: ['Overlaps an existing shift'] }),
        res({ status: 'needs-confirmation', personId: 52, locationId: 7, warnings: ['Exceeds weekly hours limit'] }),
      ],
    });
    const { getByTestId, findByText } = render(ui());
    [41, 44, 52].forEach((id) => fireEvent.press(getByTestId(`bench-chip-${id}`)));
    fireEvent.press(getByTestId('commit-button'));
    expect(await findByText('Overlaps an existing shift')).toBeTruthy();
    expect(await findByText('Exceeds weekly hours limit')).toBeTruthy();
    expect(store().assignments.map((a) => a.personId).sort()).toEqual([44, 52]);
  });

  it('confirm sends a second commit with acceptWarnings for that person', async () => {
    mockCommit
      .mockResolvedValueOnce({
        results: [
          res({ status: 'created', personId: 41, locationId: 7 }),
          res({ status: 'needs-confirmation', personId: 52, locationId: 7, warnings: ['Exceeds weekly hours limit'] }),
        ],
      })
      .mockResolvedValueOnce({ results: [res({ status: 'created', personId: 52, locationId: 7 })] });
    const { getByTestId, findByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    fireEvent.press(getByTestId('bench-chip-52'));
    fireEvent.press(getByTestId('commit-button'));
    fireEvent.press(await findByTestId('confirm-52'));
    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(2));
    const second = mockCommit.mock.calls[1][1];
    expect(second.assignments).toEqual([expect.objectContaining({ personId: 52, acceptWarnings: true })]);
    await waitFor(() => expect(store().assignments).toEqual([]));
  });

  it('lists a rejected removal (labelled with the shift person) and keeps it in the draft', async () => {
    mockCommit.mockResolvedValue({ results: [res({ status: 'rejected', shiftId: 502, errors: ['Shift not found.'] })] });
    const { getByTestId, findByText, getAllByText } = render(ui());
    fireEvent.press(getByTestId('saved-chip-502'));
    fireEvent.press(getByTestId('commit-button'));
    expect(await findByText('Shift not found.')).toBeTruthy();
    expect(getAllByText('Ana Ruiz').length).toBeGreaterThan(0);
    expect(store().removals).toEqual([502]);
  });

  it('a thrown commit error toasts commit_failed and keeps the draft', async () => {
    mockCommit.mockRejectedValue(new Error('Network Error'));
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    fireEvent.press(getByTestId('commit-button'));
    await waitFor(() => expect(toasts()).toContain('Couldn\'t publish the lineup. Your changes are kept. Try again.'));
    expect(store().assignments).toHaveLength(1);
  });

  it('closes the sheet and clears results when the date changes', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.[buttons.length - 1]?.onPress?.();
    });
    mockCommit.mockResolvedValue({ results: [res({ status: 'rejected', personId: 44, errors: ['Overlaps an existing shift'] })] });
    const { getByTestId, findByText, queryByText } = render(ui());
    fireEvent.press(getByTestId('bench-chip-44'));
    fireEvent.press(getByTestId('commit-button'));
    await findByText('Overlaps an existing shift');
    const before = store().date;
    act(() => { store().setDate(before as string); }); // no-op, sheet still open
    expect(queryByText('Overlaps an existing shift')).toBeTruthy();
    fireEvent.press(getByTestId('lineup-next-day'));
    expect(store().date).not.toBe(before);
    expect(queryByText('Overlaps an existing shift')).toBeNull();
  });

  it('offline: publish is disabled, banner shows, draft is kept', async () => {
    mockNet.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const { getByTestId, findByText } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    expect(await findByText("You're offline. Showing the last loaded lineup.")).toBeTruthy();
    fireEvent.press(getByTestId('commit-button'));
    expect(mockCommit).not.toHaveBeenCalled();
    expect(store().assignments).toHaveLength(1);
  });
});
