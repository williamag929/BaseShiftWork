jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});
jest.mock('@/hooks/useLineup', () => ({
  useLineup: jest.fn(),
  useLineupCommit: () => ({ commit: jest.fn(), isPending: false, results: null, reset: jest.fn() }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({ useIsOffline: () => false }));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import LineupScreen from '../../app/(tabs)/lineup';
import { DateStrip } from '../screens/lineup/DateStrip';
import { useLineup } from '@/hooks/useLineup';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import type { Lineup } from '@/types/lineup';

const mockUseLineup = useLineup as jest.Mock;

const lineup = (over: Partial<Lineup> = {}): Lineup => ({
  date: '2026-10-02',
  timeZone: 'America/New_York',
  canEdit: true,
  locations: [
    {
      locationId: 1,
      name: '145 Main St',
      defaultShift: { start: '07:00', end: '15:00', areaId: null },
      shifts: [
        { shiftId: 9, personId: 5, name: 'Ana Ruiz', start: '2026-10-01T23:30:00Z', end: '2026-10-02T07:00:00Z', status: 'Scheduled' },
      ],
    },
  ],
  bench: [{ personId: 6, name: 'Ben Cole', crewIds: [] }],
  unavailable: [
    { personId: 7, name: 'Cy Diaz', reason: 'Time off' },
    { personId: 8, name: 'Di Fox', reason: 'Pending inspection' },
  ],
  crews: [],
  ...over,
});

const ok = (data: Lineup) => ({ data, isLoading: false, isError: false, error: null, refetch: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  useLineupDraftStore.getState().clear();
});

describe('LineupScreen', () => {
  it('renders a location card with name, wall times and count', () => {
    mockUseLineup.mockReturnValue(ok(lineup()));
    const { getByText } = render(<LineupScreen />);
    expect(getByText('145 Main St')).toBeTruthy();
    expect(getByText('Ana Ruiz')).toBeTruthy();
    expect(getByText(/23:30/)).toBeTruthy();
    expect(getByText(/07:00/)).toBeTruthy();
    expect(getByText('lineup.people_count')).toBeTruthy();
  });

  it('shows translated reason for known reasons and the raw reason otherwise', () => {
    mockUseLineup.mockReturnValue(ok(lineup()));
    const { getByText } = render(<LineupScreen />);
    expect(getByText('lineup.reason.time_off')).toBeTruthy();
    expect(getByText('Pending inspection')).toBeTruthy();
  });

  it('shows empty_scope when there are no locations', () => {
    mockUseLineup.mockReturnValue(ok(lineup({ locations: [] })));
    expect(render(<LineupScreen />).getByText('lineup.empty_scope')).toBeTruthy();
  });

  it('shows the read-only banner only when canEdit is false', () => {
    mockUseLineup.mockReturnValue(ok(lineup({ canEdit: false })));
    expect(render(<LineupScreen />).queryByText('lineup.read_only')).toBeTruthy();
    mockUseLineup.mockReturnValue(ok(lineup({ canEdit: true })));
    expect(render(<LineupScreen />).queryByText('lineup.read_only')).toBeNull();
  });

  it('shows empty_scope for a 403 and an error state with retry otherwise', () => {
    const refetch = jest.fn();
    mockUseLineup.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { statusCode: 403 }, refetch });
    expect(render(<LineupScreen />).getByText('lineup.empty_scope')).toBeTruthy();

    mockUseLineup.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('boom'), refetch });
    const r = render(<LineupScreen />);
    expect(r.queryByText('lineup.empty_scope')).toBeNull();
    fireEvent.press(r.getByText('lineup.retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('defaults to today in local calendar and pushes the date to the draft store', () => {
    mockUseLineup.mockReturnValue(ok(lineup()));
    render(<LineupScreen />);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(mockUseLineup).toHaveBeenCalledWith(today);
    expect(useLineupDraftStore.getState().date).toBe(today);
  });

  it('refetches on focus only once per mount, not on date change', () => {
    const refetch = jest.fn();
    mockUseLineup.mockReturnValue({ ...ok(lineup()), refetch });
    render(<LineupScreen />);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch again when the date changes', () => {
    const refetch = jest.fn();
    mockUseLineup.mockReturnValue({ ...ok(lineup()), refetch });
    const { getByTestId } = render(<LineupScreen />);
    fireEvent.press(getByTestId('lineup-next-day'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('changing the date calls setDate (no confirmation when the draft is clean)', () => {
    mockUseLineup.mockReturnValue(ok(lineup()));
    const alert = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<LineupScreen />);
    const before = useLineupDraftStore.getState().date;
    fireEvent.press(getByTestId('lineup-next-day'));
    expect(alert).not.toHaveBeenCalled();
    expect(useLineupDraftStore.getState().date).not.toBe(before);
  });
});

describe('DateStrip', () => {
  it('asks for confirmation before changing the date when confirmDiscard is true', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onChange = jest.fn();
    const { getByTestId } = render(<DateStrip date="2026-10-02" onChange={onChange} confirmDiscard />);
    fireEvent.press(getByTestId('lineup-next-day'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('lineup.discard_title');
    expect(alert.mock.calls[0][1]).toBe('lineup.discard_body');
    expect(onChange).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    buttons.find((b) => b.style !== 'cancel')!.onPress!();
    expect(onChange).toHaveBeenCalledWith('2026-10-03');
  });

  it('calls onChange directly when confirmDiscard is false', () => {
    const alert = jest.spyOn(Alert, 'alert');
    const onChange = jest.fn();
    const { getByTestId } = render(<DateStrip date="2026-10-31" onChange={onChange} confirmDiscard={false} />);
    fireEvent.press(getByTestId('lineup-next-day'));
    expect(alert).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('2026-11-01');
    fireEvent.press(getByTestId('lineup-prev-day'));
    expect(onChange).toHaveBeenCalledWith('2026-10-30');
  });
});

describe('LineupScreen disabled query', () => {
  it('shows a neutral empty state, not a skeleton, when there is no data and no loading/error', () => {
    mockUseLineup.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn() });
    expect(render(<LineupScreen />).getByText('lineup.empty_scope')).toBeTruthy();
  });
});
