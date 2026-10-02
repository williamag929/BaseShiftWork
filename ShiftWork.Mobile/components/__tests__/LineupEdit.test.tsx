jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  return { useFocusEffect: (cb: () => void) => { React.useEffect(() => cb(), []); } }; // eslint-disable-line
});
jest.mock('@/hooks/useLineup', () => ({ useLineup: jest.fn() }));
jest.mock('@/hooks/usePermission', () => ({ usePermission: jest.fn() }));

import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import LineupScreen from '../../app/(tabs)/lineup';
import { LocaleProvider } from '@/i18n';
import { useLineup } from '@/hooks/useLineup';
import { usePermission } from '@/hooks/usePermission';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import { useToastStore } from '@/hooks/useToast';
import type { Lineup } from '@/types/lineup';

const mockUseLineup = useLineup as jest.Mock;
const mockPerm = usePermission as jest.Mock;

const shift = { start: '07:00', end: '15:00', areaId: null };
const lineup = (over: Partial<Lineup> = {}): Lineup => ({
  date: '2026-10-02',
  timeZone: 'America/New_York',
  canEdit: true,
  locations: [
    {
      locationId: 7, name: 'Site Seven', defaultShift: shift,
      shifts: [{ shiftId: 9, personId: 5, name: 'Ana Ruiz', start: '2026-10-02T07:00:00Z', end: '2026-10-02T15:00:00Z', status: 'Scheduled' }],
    },
    { locationId: 8, name: 'Site Eight', defaultShift: shift, shifts: [] },
  ],
  bench: [
    { personId: 41, name: 'Luis Vega', crewIds: [1] },
    { personId: 52, name: 'Mia Soto', crewIds: [1] },
  ],
  unavailable: [],
  crews: [{ crewId: 1, name: 'Framing', memberIds: [41, 44, 52] }],
  ...over,
});
const ok = (data: Lineup) => ({ data, isLoading: false, isError: false, error: null, refetch: jest.fn() });
const perms = (...p: string[]) => mockPerm.mockImplementation((k: string) => p.includes(k));
const ui = () => <LocaleProvider><LineupScreen /></LocaleProvider>;
const store = () => useLineupDraftStore.getState();
const toasts = () => useToastStore.getState().toasts.map((x) => x.message);

beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  useToastStore.getState().dismissAll();
  perms('lineup.edit');
  mockUseLineup.mockReturnValue(ok(lineup()));
});

describe('Lineup editing', () => {
  it('tapping a bench person assigns them to the active (first) site', () => {
    const { queryByTestId, getByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    expect(store().assignments).toEqual([expect.objectContaining({ personId: 41, locationId: 7, start: '07:00', end: '15:00' })]);
    expect(queryByTestId('bench-chip-41')).toBeNull();
    expect(getByTestId('drafted-chip-41')).toBeTruthy();
    expect(within(getByTestId('drafted-chip-41')).getByText('07:00–15:00')).toBeTruthy();
  });

  it('tapping a card makes it the active target', () => {
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('location-card-8'));
    fireEvent.press(getByTestId('bench-chip-41'));
    expect(store().assignments[0].locationId).toBe(8);
  });

  it('tapping a drafted person unassigns', () => {
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    fireEvent.press(getByTestId('drafted-chip-41'));
    expect(store().assignments).toEqual([]);
    expect(getByTestId('bench-chip-41')).toBeTruthy();
  });

  it('saved person tap queues removal and moves via remove-then-assign', () => {
    const { getByTestId, queryByTestId } = render(ui());
    fireEvent.press(getByTestId('saved-chip-9'));
    expect(store().removals).toEqual([9]);
    expect(getByTestId('bench-chip-5')).toBeTruthy();
    expect(getByTestId('removed-chip-9')).toBeTruthy();
    fireEvent.press(getByTestId('location-card-8'));
    fireEvent.press(getByTestId('bench-chip-5'));
    expect(store().removals).toEqual([9]);
    expect(store().assignments).toEqual([expect.objectContaining({ personId: 5, locationId: 8 })]);
    // undo is not offered while the person is drafted elsewhere
    fireEvent.press(getByTestId('removed-chip-9'));
    expect(store().removals).toEqual([9]);
    expect(queryByTestId('saved-chip-9')).toBeNull();
  });

  it('a queued removal can be undone', () => {
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('saved-chip-9'));
    fireEvent.press(getByTestId('removed-chip-9'));
    expect(store().removals).toEqual([]);
    expect(getByTestId('saved-chip-9')).toBeTruthy();
  });

  it.each([
    [[], 'lineup.no_default_shift_foreman'],
    [['lineup.all-locations'], 'lineup.no_default_shift_all'],
  ])('site without default shift blocks assign (%j)', (extra, key) => {
    perms('lineup.edit', ...(extra as string[]));
    const d = lineup();
    d.locations[0].defaultShift = null;
    mockUseLineup.mockReturnValue(ok(d));
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    expect(store().assignments).toEqual([]);
    expect(toasts()[0]).toBe(
      key === 'lineup.no_default_shift_all'
        ? 'This site has no default shift. Set one in the admin app.'
        : 'This site has no default shift. Ask an admin to set one.',
    );
  });

  it('crew quick-fill adds bench members and reports counts', () => {
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('add-crew-7'));
    fireEvent.press(getByTestId('crew-pick-1'));
    expect(store().assignments.map((a) => a.personId).sort()).toEqual([41, 52]);
    expect(store().assignments.every((a) => a.locationId === 7)).toBe(true);
    expect(toasts()).toEqual(['2 of 3 added, 1 busy']);
  });

  it('crew on a site without default shift toasts and changes nothing', () => {
    const d = lineup();
    d.locations[0].defaultShift = null;
    mockUseLineup.mockReturnValue(ok(d));
    const { getByTestId } = render(ui());
    fireEvent.press(getByTestId('add-crew-7'));
    fireEvent.press(getByTestId('crew-pick-1'));
    expect(store().assignments).toEqual([]);
    expect(toasts()).toEqual(['This site has no default shift. Ask an admin to set one.']);
  });

  it.each([
    ['canEdit false', false, ['lineup.edit']],
    ['no lineup.edit', true, []],
  ])('read-only when %s', (_n, canEdit, p) => {
    perms(...(p as string[]));
    mockUseLineup.mockReturnValue(ok(lineup({ canEdit: canEdit as boolean })));
    const { getByTestId, queryByTestId } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    fireEvent.press(getByTestId('saved-chip-9'));
    expect(store().assignments).toEqual([]);
    expect(store().removals).toEqual([]);
    expect(queryByTestId('add-crew-7')).toBeNull();
  });

  it('falls back to the first site when the active one disappears', () => {
    const { getByTestId, rerender } = render(ui());
    fireEvent.press(getByTestId('location-card-8'));
    const d = lineup();
    d.locations = [d.locations[0]];
    mockUseLineup.mockReturnValue(ok(d));
    rerender(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    expect(store().assignments[0].locationId).toBe(7);
  });

  it('keeps the drafted person labelled when a refetch moves them to unavailable', () => {
    const { getByTestId, rerender } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    const d = lineup();
    d.bench = d.bench.filter((p) => p.personId !== 41);
    d.unavailable = [{ personId: 41, name: 'Luis Vega', reason: 'Time off' }];
    mockUseLineup.mockReturnValue(ok(d));
    rerender(ui());
    expect(within(getByTestId('drafted-chip-41')).getByText('Luis Vega')).toBeTruthy();
  });

  it('shows a placeholder when the drafted person is no longer anywhere in the data', () => {
    const { getByTestId, rerender } = render(ui());
    fireEvent.press(getByTestId('bench-chip-41'));
    const d = lineup();
    d.bench = d.bench.filter((p) => p.personId !== 41);
    mockUseLineup.mockReturnValue(ok(d));
    rerender(ui());
    expect(within(getByTestId('drafted-chip-41')).getByText('Unknown person')).toBeTruthy();
  });
});
