import { wallTime, reasonKey, mergeLineup, crewFill, buildCommitRequest, DraftState } from '@/utils/lineup';
import type { Lineup } from '@/types/lineup';

const shift = { start: '07:00', end: '15:00', areaId: null };

const server: Lineup = {
  date: '2026-10-01',
  timeZone: 'America/New_York',
  canEdit: true,
  locations: [
    {
      locationId: 7,
      name: 'Site 7',
      defaultShift: shift,
      shifts: [{ shiftId: 501, personId: 44, name: 'Dana', start: shift.start, end: shift.end, status: 'Scheduled' }],
    },
    { locationId: 8, name: 'Site 8', defaultShift: null, shifts: [] },
  ],
  bench: [
    { personId: 41, name: 'Ann', crewIds: [1] },
    { personId: 52, name: 'Bo', crewIds: [1] },
  ],
  unavailable: [],
  crews: [{ crewId: 1, name: 'Crew A', memberIds: [41, 44, 52] }],
};

const empty: DraftState = { assignments: [], removals: [], feedback: {} };
const a = (personId: number, locationId: number) => ({
  personId, locationId, areaId: null, start: shift.start, end: shift.end, acceptWarnings: false,
});

describe('wallTime', () => {
  it('slices HH:mm after T', () => {
    expect(wallTime('2026-10-01T07:00:00Z')).toBe('07:00');
    expect(wallTime('2026-10-01T23:30:00Z')).toBe('23:30');
    expect(wallTime('07:00')).toBe('07:00');
  });
});

describe('reasonKey', () => {
  it('maps known reasons', () => {
    expect(reasonKey('Time off')).toBe('lineup.reason.time_off');
    expect(reasonKey('Assigned to another site')).toBe('lineup.reason.other_site');
    expect(reasonKey('Already scheduled')).toBe('lineup.reason.already_scheduled');
  });
  it('returns null for unknown', () => {
    expect(reasonKey('Something new')).toBeNull();
  });
});

describe('mergeLineup', () => {
  it('moves drafted people off the bench into the location', () => {
    const v = mergeLineup(server, { ...empty, assignments: [a(41, 7)] });
    expect(v.bench.map((p) => p.personId)).toEqual([52]);
    const loc = v.locations.find((l) => l.locationId === 7)!;
    expect(loc.drafted.map((d) => d.personId)).toEqual([41]);
    expect(loc.saved).toHaveLength(1);
  });

  it('hides removed shifts and benches their person once, with crewIds', () => {
    const v = mergeLineup(server, { ...empty, removals: [501] });
    const loc = v.locations.find((l) => l.locationId === 7)!;
    expect(loc.saved).toHaveLength(0);
    expect(v.bench).toEqual([
      { personId: 41, name: 'Ann', crewIds: [1] },
      { personId: 52, name: 'Bo', crewIds: [1] },
      { personId: 44, name: 'Dana', crewIds: [1] },
    ]);
    expect(v.bench.filter((p) => p.personId === 44)).toHaveLength(1);
  });

  it('assigning a removed person elsewhere takes them off the bench again', () => {
    const v = mergeLineup(server, { ...empty, removals: [501], assignments: [a(44, 8)] });
    expect(v.bench.some((p) => p.personId === 44)).toBe(false);
    expect(v.locations.find((l) => l.locationId === 8)!.drafted.map((d) => d.personId)).toEqual([44]);
  });

  it('counts both lists in changeCount', () => {
    const v = mergeLineup(server, { ...empty, removals: [501], assignments: [a(41, 7), a(52, 8)] });
    expect(v.changeCount).toBe(3);
  });
});

describe('crewFill', () => {
  it('returns bench members and busy count', () => {
    const v = mergeLineup(
      { ...server, crews: [{ crewId: 1, name: 'A', memberIds: [41, 44, 52] }] },
      empty,
    );
    expect(crewFill(v, 1)).toEqual({ memberIds: [41, 52], busy: 1 });
  });
});

describe('buildCommitRequest', () => {
  it('shapes assignments and removals', () => {
    const req = buildCommitRequest('2026-10-01', { ...empty, assignments: [a(41, 7)], removals: [501] });
    expect(req).toEqual({
      date: '2026-10-01',
      assignments: [
        { personId: 41, locationId: 7, areaId: null, start: shift.start, end: shift.end, acceptWarnings: false },
      ],
      removals: [501],
    });
  });
});
