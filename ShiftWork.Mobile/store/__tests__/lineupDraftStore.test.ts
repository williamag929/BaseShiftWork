import { useLineupDraftStore } from '@/store/lineupDraftStore';

const shift = { start: '07:00', end: '15:00', areaId: null };
const s = () => useLineupDraftStore.getState();

beforeEach(() => {
  useLineupDraftStore.getState().clear();
});

describe('lineupDraftStore', () => {
  it('setDate clears on a different date and keeps on the same', () => {
    s().setDate('2026-10-01');
    s().assign(41, 7, shift);
    s().setDate('2026-10-01');
    expect(s().assignments).toHaveLength(1);
    s().setDate('2026-10-02');
    expect(s().assignments).toHaveLength(0);
    expect(s().date).toBe('2026-10-02');
  });

  it('assign twice leaves one assignment at the last site', () => {
    s().assign(41, 7, shift);
    s().assign(41, 8, shift);
    expect(s().assignments).toHaveLength(1);
    expect(s().assignments[0]).toMatchObject({ personId: 41, locationId: 8, acceptWarnings: false });
  });

  it('assignMany and unassign', () => {
    s().assignMany([41, 44], 7, shift);
    expect(s().assignments.map((x) => x.personId)).toEqual([41, 44]);
    s().unassign(41);
    expect(s().assignments.map((x) => x.personId)).toEqual([44]);
  });

  it('removeShift and undoRemoval', () => {
    s().removeShift(501);
    s().removeShift(501);
    expect(s().removals).toEqual([501]);
    s().undoRemoval(501);
    expect(s().removals).toEqual([]);
  });

  it('applyResults resolves successes and records rejections', () => {
    s().assignMany([41, 44], 7, shift);
    s().removeShift(501);
    s().applyResults([
      { status: 'created', personId: 41, locationId: 7, errors: [], warnings: [] },
      { status: 'rejected', personId: 44, locationId: 7, errors: ['Overlaps'], warnings: [] },
      { status: 'removed', shiftId: 501, personId: 5, locationId: 7, errors: [], warnings: [] },
    ]);
    expect(s().assignments.map((x) => x.personId)).toEqual([44]);
    expect(s().feedback).toEqual({ p44: { status: 'rejected', messages: ['Overlaps'] } });
    expect(s().removals).toEqual([]);
  });

  it('keeps a rejected removal with s-keyed feedback', () => {
    s().removeShift(502);
    s().applyResults([{ status: 'rejected', shiftId: 502, errors: ['Locked'], warnings: [] }]);
    expect(s().removals).toEqual([502]);
    expect(s().feedback.s502).toEqual({ status: 'rejected', messages: ['Locked'] });
  });

  it('needs-confirmation keeps item; acceptWarnings flips flag and clears feedback', () => {
    s().assign(52, 7, shift);
    s().applyResults([{ status: 'needs-confirmation', personId: 52, locationId: 7, errors: [], warnings: ['Overtime'] }]);
    expect(s().assignments).toHaveLength(1);
    expect(s().feedback.p52).toEqual({ status: 'needs-confirmation', messages: ['Overtime'] });
    s().acceptWarnings([52]);
    expect(s().assignments[0].acceptWarnings).toBe(true);
    expect(s().feedback.p52).toBeUndefined();
  });

  it('assignMany dedupes personIds', () => {
    s().assignMany([41, 41], 7, shift);
    expect(s().assignments).toHaveLength(1);
  });

  it('created result leaves an assignment at a different site untouched', () => {
    s().assign(41, 8, shift);
    s().applyResults([{ status: 'created', personId: 41, locationId: 7, errors: [], warnings: [] }]);
    expect(s().assignments).toHaveLength(1);
    expect(s().assignments[0].locationId).toBe(8);
  });

  it('unchanged drops the assignment', () => {
    s().assign(41, 7, shift);
    s().applyResults([{ status: 'unchanged', personId: 41, locationId: 7, errors: [], warnings: [] }]);
    expect(s().assignments).toHaveLength(0);
  });

  it('setScope isolates drafts between companies and dates', () => {
    s().setScope('co-a', '2026-10-01');
    s().assign(41, 7, shift);
    s().setScope('co-a', '2026-10-01');
    expect(s().assignments).toHaveLength(1);
    s().setScope('co-b', '2026-10-01');
    expect(s().assignments).toHaveLength(0);
    expect(s().companyId).toBe('co-b');
    s().assign(41, 7, shift);
    s().setScope('co-b', '2026-10-02');
    expect(s().assignments).toHaveLength(0);
  });

  it('prune drops removals and assignments the server no longer has, with their feedback', () => {
    s().removeShift(501);
    s().removeShift(502);
    s().assign(41, 7, shift);
    s().assign(44, 99, shift);
    s().applyResults([
      { status: 'rejected', shiftId: 501, errors: ['Shift not found.'], warnings: [] },
      { status: 'rejected', personId: 44, locationId: 99, errors: ['x'], warnings: [] },
    ]);
    s().prune([502], [7, 8]);
    expect(s().removals).toEqual([502]);
    expect(s().assignments.map((a) => a.personId)).toEqual([41]);
    expect(s().feedback).toEqual({});
  });

  it('a removed result (real shape, with personId/locationId) clears s-feedback and keeps the person\'s draft elsewhere', () => {
    s().removeShift(501);
    s().assign(41, 8, shift);
    s().applyResults([{ status: 'rejected', shiftId: 501, errors: ['Locked'], warnings: [] }]);
    expect(s().feedback.s501).toBeDefined();
    s().applyResults([{ status: 'removed', shiftId: 501, personId: 41, locationId: 7, errors: [], warnings: [] }]);
    expect(s().removals).toEqual([]);
    expect(s().feedback.s501).toBeUndefined();
    expect(s().assignments).toEqual([expect.objectContaining({ personId: 41, locationId: 8 })]);
  });
});
