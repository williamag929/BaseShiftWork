import { create } from 'zustand';
import type { DefaultShift, LineupCommitResult } from '@/types/lineup';
import type { DraftAssignment, DraftState } from '@/utils/lineup';

interface LineupDraftState extends DraftState {
  date: string | null;
  setDate: (date: string) => void;
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
  ...blank,
  setDate: (date) =>
    set((s) => (s.date === date ? s : { date, assignments: [], removals: [], feedback: {} })),
  assign: (personId, locationId, shift) =>
    set((s) => ({
      assignments: [...s.assignments.filter((a) => a.personId !== personId), draftOf(personId, locationId, shift)],
      feedback: without(s.feedback, [`p${personId}`]),
    })),
  assignMany: (personIds, locationId, shift) =>
    set((s) => ({
      assignments: [
        ...s.assignments.filter((a) => !personIds.includes(a.personId)),
        ...personIds.map((id) => draftOf(id, locationId, shift)),
      ],
      feedback: without(s.feedback, personIds.map((id) => `p${id}`)),
    })),
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
        const key = r.personId != null ? `p${r.personId}` : r.shiftId != null ? `s${r.shiftId}` : null;
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
  clear: () => set({ date: null, ...blank }),
}));
