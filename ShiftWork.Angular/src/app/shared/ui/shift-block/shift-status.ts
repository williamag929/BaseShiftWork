import type { ShiftBlock } from '../../../core/models/schedule-grid.model';

export type LzShiftStatus = 'published' | 'draft' | 'open' | 'conflict' | 'timeOff' | 'locked' | 'void';

export function toLzShiftStatus(shift: Pick<ShiftBlock, 'status' | 'isLocked'>): LzShiftStatus {
  if (shift.isLocked || shift.status === 'locked') return 'locked';
  switch (shift.status) {
    case 'unpublished':
      return 'draft';
    case 'open':
      return 'open';
    case 'void':
      return 'void';
    default:
      return 'published';
  }
}
