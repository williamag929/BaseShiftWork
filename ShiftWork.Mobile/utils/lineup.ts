import type {
  DefaultShift,
  Lineup,
  LineupCommitRequest,
  LineupCrew,
  LineupPerson,
  LineupShift,
  LineupUnavailable,
} from '@/types/lineup';

export const wallTime = (iso: string): string => {
  const t = iso.includes('T') ? iso.split('T')[1] : iso;
  return t.slice(0, 5);
};

const REASON_KEYS: Record<string, string> = {
  'Time off': 'lineup.reason.time_off',
  'Assigned to another site': 'lineup.reason.other_site',
  'Already scheduled': 'lineup.reason.already_scheduled',
};

export const reasonKey = (reason: string): string | null => REASON_KEYS[reason] ?? null;

export type DraftAssignment = {
  personId: number;
  locationId: number;
  areaId: number | null;
  start: string;
  end: string;
  acceptWarnings: boolean;
};

export type DraftFeedback = { status: 'rejected' | 'needs-confirmation'; messages: string[] };

export type DraftState = {
  assignments: DraftAssignment[];
  removals: number[];
  feedback: Record<string, DraftFeedback>;
};

export type LineupView = {
  locations: {
    locationId: number;
    name: string;
    defaultShift: DefaultShift | null;
    saved: LineupShift[];
    drafted: DraftAssignment[];
    count: number;
  }[];
  bench: LineupPerson[];
  unavailable: LineupUnavailable[];
  crews: LineupCrew[];
  changeCount: number;
};

export function mergeLineup(server: Lineup, draft: DraftState): LineupView {
  const drafted = new Set(draft.assignments.map((a) => a.personId));
  const removed = new Set(draft.removals);

  const locations = server.locations.map((l) => {
    const saved = l.shifts.filter((s) => !removed.has(s.shiftId));
    const mine = draft.assignments.filter((a) => a.locationId === l.locationId);
    return {
      locationId: l.locationId,
      name: l.name,
      defaultShift: l.defaultShift,
      saved,
      drafted: mine,
      count: saved.length + mine.length,
    };
  });

  const bench: LineupPerson[] = [];
  const seen = new Set<number>();
  const push = (p: LineupPerson) => {
    if (drafted.has(p.personId) || seen.has(p.personId)) return;
    seen.add(p.personId);
    bench.push(p);
  };
  server.bench.forEach(push);
  server.locations.forEach((l) =>
    l.shifts
      .filter((s) => removed.has(s.shiftId))
      .forEach((s) =>
        push({
          personId: s.personId,
          name: s.name,
          crewIds: server.crews.filter((c) => c.memberIds.includes(s.personId)).map((c) => c.crewId),
        }),
      ),
  );

  return {
    locations,
    bench,
    unavailable: server.unavailable,
    crews: server.crews,
    changeCount: draft.assignments.length + draft.removals.length,
  };
}

export function crewFill(view: LineupView, crewId: number): { memberIds: number[]; busy: number } {
  const crew = view.crews.find((c) => c.crewId === crewId);
  if (!crew) return { memberIds: [], busy: 0 };
  const onBench = new Set(view.bench.map((p) => p.personId));
  const memberIds = crew.memberIds.filter((id) => onBench.has(id));
  return { memberIds, busy: crew.memberIds.length - memberIds.length };
}

export function buildCommitRequest(date: string, draft: DraftState): LineupCommitRequest {
  return {
    date,
    assignments: draft.assignments.map((a) => ({
      personId: a.personId,
      locationId: a.locationId,
      areaId: a.areaId,
      start: a.start,
      end: a.end,
      acceptWarnings: a.acceptWarnings,
    })),
    removals: [...draft.removals],
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Today's calendar date in the device's local time zone, as 'YYYY-MM-DD'. */
export const localToday = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

/** Pure calendar arithmetic on a 'YYYY-MM-DD' string (no time zone involved). */
export const shiftDate = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  const u = new Date(Date.UTC(y, m - 1, d + days));
  return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
};

/** Expo Router tab options gating the Lineup tab on the `lineup.view` permission. */
export const lineupTabOptions = (hasView: boolean): { href?: null } => (hasView ? {} : { href: null });
