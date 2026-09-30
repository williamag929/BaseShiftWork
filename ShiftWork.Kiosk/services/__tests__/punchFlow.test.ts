import { nextEventType, nextStep, needsPhoto, shouldShowInterstitial, shouldShowLoadError, STRICT_DEFAULT_CONFIG } from '../punchFlow';
import type { KioskConfig, KioskEmployee } from '@/types';

const emp = (over: Partial<KioskEmployee> = {}): KioskEmployee => ({ personId: 1, name: 'Maria', ...over });
const cfg = (over: Partial<KioskConfig> = {}): KioskConfig => ({ ...STRICT_DEFAULT_CONFIG, ...over });

describe('nextEventType', () => {
  it.each([
    ['OnShift', 'ClockOut'],
    ['OnShift:Late', 'ClockOut'],
    ['onshift:NoSchedule', 'ClockOut'],
    ['OffShift', 'ClockIn'],
    [undefined, 'ClockIn'],
    [null, 'ClockIn'],
    ['', 'ClockIn'],
  ])('%s -> %s', (status, expected) => {
    expect(nextEventType(status as string | undefined)).toBe(expected);
  });
});

describe('nextStep', () => {
  const base = { employee: emp(), eventType: 'ClockIn' as const, questionCount: 0 };

  it('PIN off, photo off -> straight to commit', () => {
    expect(nextStep('start', { ...base, config: cfg({ requirePin: false, requirePhoto: false }) })).toBe('commit');
  });
  it('PIN off, photo on -> photo, then commit', () => {
    const config = cfg({ requirePin: false, requirePhoto: true });
    expect(nextStep('start', { ...base, config })).toBe('photo');
    expect(nextStep('photo', { ...base, config })).toBe('commit');
  });
  it('PIN on, photo off -> pin, then commit', () => {
    const config = cfg({ requirePin: true, requirePhoto: false });
    expect(nextStep('start', { ...base, config })).toBe('pin');
    expect(nextStep('pin', { ...base, config })).toBe('commit');
  });
  it('PIN on, photo on -> pin, photo, commit', () => {
    const config = cfg();
    expect(nextStep('start', { ...base, config })).toBe('pin');
    expect(nextStep('pin', { ...base, config })).toBe('photo');
    expect(nextStep('photo', { ...base, config })).toBe('commit');
  });
  it('photo-exempt employee skips the camera even when the site requires photos', () => {
    const config = cfg({ requirePin: false });
    expect(needsPhoto(config, emp({ photoExempt: true }))).toBe(false);
    expect(nextStep('start', { ...base, employee: emp({ photoExempt: true }), config })).toBe('commit');
  });
  it('questions come only on clock-out and only when there are active questions', () => {
    const config = cfg({ requirePin: false, requirePhoto: false });
    expect(nextStep('start', { ...base, eventType: 'ClockIn', questionCount: 3, config })).toBe('commit');
    expect(nextStep('start', { ...base, eventType: 'ClockOut', questionCount: 0, config })).toBe('commit');
    expect(nextStep('start', { ...base, eventType: 'ClockOut', questionCount: 3, config })).toBe('questions');
    expect(nextStep('questions', { ...base, eventType: 'ClockOut', questionCount: 3, config })).toBe('commit');
  });
  it('clock-out with PIN, photo and questions runs pin, photo, questions, commit in order', () => {
    const ctx = { ...base, eventType: 'ClockOut' as const, questionCount: 2, config: cfg() };
    expect(nextStep('start', ctx)).toBe('pin');
    expect(nextStep('pin', ctx)).toBe('photo');
    expect(nextStep('photo', ctx)).toBe('questions');
    expect(nextStep('questions', ctx)).toBe('commit');
  });
});

describe('shouldShowInterstitial', () => {
  it('shows after a clock-out when every queued punch is healthy', () => {
    expect(shouldShowInterstitial('ClockOut', [{ attempts: 0 }])).toBe(true);
    expect(shouldShowInterstitial('ClockOut', [])).toBe(true);
  });
  it('is skipped after a clock-in', () => {
    expect(shouldShowInterstitial('ClockIn', [])).toBe(false);
    expect(shouldShowInterstitial(null, [])).toBe(false);
  });
  it('is skipped when any queued punch has already failed to send (kiosk looks offline)', () => {
    expect(shouldShowInterstitial('ClockOut', [{ attempts: 0 }, { attempts: 2 }])).toBe(false);
  });
});

describe('shouldShowInterstitial with failed entries', () => {
  it('ignores permanently failed entries', () => {
    expect(shouldShowInterstitial('ClockOut', [{ attempts: 3, status: 'failed' }])).toBe(true);
  });
  it('still skips when a live entry is retrying', () => {
    expect(shouldShowInterstitial('ClockOut', [{ attempts: 3, status: 'failed' }, { attempts: 1, status: 'pending' }])).toBe(false);
  });
});

describe('shouldShowLoadError', () => {
  it('shows only when there is an error and no data', () => {
    expect(shouldShowLoadError({ error: new Error('x'), data: undefined })).toBe(true);
  });
  it('keeps the list when a refetch failed but data exists', () => {
    expect(shouldShowLoadError({ error: new Error('x'), data: [] })).toBe(false);
  });
  it('no error, no screen', () => {
    expect(shouldShowLoadError({ error: null, data: undefined })).toBe(false);
  });
});
