import { undoRemainingMs } from '../outbox.service';

describe('undoRemainingMs', () => {
  it('is the time left in the hold', () => {
    expect(undoRemainingMs({ holdUntil: 5_000 }, 3_500)).toBe(1_500);
  });
  it('is 0 once the hold has passed', () => {
    expect(undoRemainingMs({ holdUntil: 5_000 }, 5_000)).toBe(0);
    expect(undoRemainingMs({ holdUntil: 5_000 }, 9_000)).toBe(0);
  });
  it('is 0 when the entry is unknown', () => {
    expect(undoRemainingMs(undefined, 1)).toBe(0);
  });
});
