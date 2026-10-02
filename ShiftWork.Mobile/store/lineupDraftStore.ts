import { create } from 'zustand';
import type { DefaultShift, LineupCommitResult } from '@/types/lineup';
import type { DraftAssignment, DraftState } from '@/utils/lineup';

interface LineupDraftState extends DraftState {
  date: string | null;
  /** Company the draft belongs to; a different company or date discards the draft. */
  companyId: string | null;
  setDate: (date: string) => void;
  setScope: (companyId: string | null, date: string) => void;
  /** Drop removals/assignments that no longer exist in the server's current lineup. */
  prune: (validShiftIds: number[], validLocationIds: number[]) => void;
  assign: (personId: number, locationId: number, shift: DefaultShift) => void;
  assignMany: (personIds: number[], locationId: number, shift: DefaultShift) => void;
  unassign: (personId: number) => void;
  removeShift: (shiftId: number) => void;
  undoRemoval: (shiftId: number) => void;
  acceptWarnings: (personIds: number[]) => void;
  applyResults: (results: LineupCommitResult[]) => void;
  clear: () => void;
}

const blank = { assignments: [], removals: [], feedback: {} };

const draftOf = (personId: number, locationId: number, shift: DefaultShift): DraftAssignment => ({
  personId,
  locationId,
  areaId: shift.areaId,
  start: shift.start,
  end: shift.end,
  acceptWarnings: false,
});

const without = <T extends object>(obj: T, keys: string[]): T => {
  const copy = { ...obj } as Record<string, unknown>;
  keys.forEach((k) => delete copy[k]);
  return copy as T;
};

export const useLineupDraftStore = create<LineupDraftState>((set) => ({
  date: null,
  companyId: null,
  ...blank,
  setDate: (date) =>
    set((s) => (s.date === date ? s : { date, assignments: [], removals: [], feedback: {} })),
  setScope: (companyId, date) =>
    set((s) =>
      s.date === date && s.companyId === companyId
        ? s
        : { companyId, date, assignments: [], removals: [], feedback: {} },
    ),
  prune: (validShiftIds, validLocationIds) =>
    set((s) => {
      const removals = s.removals.filter((id) => validShiftIds.includes(id));
      const assignments = s.assignments.filter((a) => validLocationIds.includes(a.locationId));
      if (removals.length === s.removals.length && assignments.length === s.assignments.length) return s;
      const droppedKeys = [
        ...s.removals.filter((id) => !removals.includes(id)).map((id) => `s${id}`),
        ...s.assignments.filter((a) => !assignments.includes(a)).map((a) => `p${a.personId}`),
      ];
      return { removals, assignments, feedback: without(s.feedback, droppedKeys) };
    }),
  assign: (personId, locationId, shift) =>
    set((s) => ({
      assignments: [...s.assignments.filter((a) => a.personId !== personId), draftOf(personId, locationId, shift)],
      feedback: without(s.feedback, [`p${personId}`]),
    })),
  assignMany: (rawIds, locationId, shift) =>
    set((s) => {
      const personIds = [...new Set(rawIds)];
      return {
      assignments: [
        ...s.assignments.filter((a) => !personIds.includes(a.personId)),
        ...personIds.map((id) => draftOf(id, locationId, shift)),
      ],
      feedback: without(s.feedback, personIds.map((id) => `p${id}`)),
      };
    }),
  unassign: (personId) =>
    set((s) => ({
      assignments: s.assignments.filter((a) => a.personId !== personId),
      feedback: without(s.feedback, [`p${personId}`]),
    })),
  removeShift: (shiftId) =>
    set((s) => (s.removals.includes(shiftId) ? s : { removals: [...s.removals, shiftId] })),
  undoRemoval: (shiftId) =>
    set((s) => ({
      removals: s.removals.filter((id) => id !== shiftId),
      feedback: without(s.feedback, [`s${shiftId}`]),
    })),
  acceptWarnings: (personIds) =>
    set((s) => ({
      assignments: s.assignments.map((a) => (personIds.includes(a.personId) ? { ...a, acceptWarnings: true } : a)),
      feedback: without(s.feedback, personIds.map((id) => `p${id}`)),
    })),
  applyResults: (results) =>
    set((s) => {
      let assignments = s.assignments;
      let removals = s.removals;
      let feedback = s.feedback;
      for (const r of results) {
        // The server sets personId/locationId on `removed` too, so key by result kind, not by which ids exist.
        const isShiftResult = r.status === 'removed' || (r.status === 'rejected' && r.personId == null);
        const key = isShiftResult
          ? r.shiftId != null ? `s${r.shiftId}` : null
          : r.personId != null ? `p${r.personId}` : null;
        if (r.status === 'created' || r.status === 'unchanged') {
          assignments = assignments.filter((a) => !(a.personId === r.personId && a.locationId === r.locationId));
          if (key) feedback = without(feedback, [key]);
        } else if (r.status === 'removed') {
          removals = removals.filter((id) => id !== r.shiftId);
          if (key) feedback = without(feedback, [key]);
        } else if (key) {
          feedback = {
            ...feedback,
            [key]: {
              status: r.status,
              messages: r.status === 'rejected' ? r.errors : r.warnings,
            },
          };
        }
      }
      return { assignments, removals, feedback };
    }),
  clear: () => set({ date: null, companyId: null, ...blank }),
}));
