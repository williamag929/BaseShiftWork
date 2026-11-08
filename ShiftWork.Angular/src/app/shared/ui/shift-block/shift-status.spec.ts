import { toLzShiftStatus } from './shift-status';

describe('toLzShiftStatus', () => {
  it('maps locked status to locked', () => {
    expect(toLzShiftStatus({ status: 'locked' })).toBe('locked');
  });
  it('maps isLocked to locked even when published', () => {
    expect(toLzShiftStatus({ status: 'published', isLocked: true })).toBe('locked');
  });
  it('maps unpublished to draft', () => {
    expect(toLzShiftStatus({ status: 'unpublished' })).toBe('draft');
  });
  it('maps published to published', () => {
    expect(toLzShiftStatus({ status: 'published' })).toBe('published');
  });
  it('maps open to open', () => {
    expect(toLzShiftStatus({ status: 'open' })).toBe('open');
  });
  it('maps void to void', () => {
    expect(toLzShiftStatus({ status: 'void' })).toBe('void');
  });
});
