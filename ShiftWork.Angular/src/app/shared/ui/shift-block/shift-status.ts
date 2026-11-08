import type { ShiftBlock } from '../../../core/models/schedule-grid.model';

export type LzShiftStatus = 'published' | 'draft' | 'open' | 'conflict' | 'timeOff' | 'locked' | 'void';

export function toLzShiftStatus(shift: Pick<ShiftBlock, 'status' | 'isLocked'>): LzShiftStatus {
  if (shift.status === 'void') return 'void';
  if (shift.isLocked || shift.status === 'locked') return 'locked';
  switch (shift.status) {
    case 'unpublished':
      return 'draft';
    case 'open':
      return 'open';
    default:
      return 'published';
  }
}
