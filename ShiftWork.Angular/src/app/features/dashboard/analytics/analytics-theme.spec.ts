import { analyticsPalette } from './analytics-theme';

describe('analyticsPalette', () => {
  const root = document.documentElement;
  const saved: Record<string, string> = {};
  const tokens = ['--lz-link', '--lz-success', '--lz-amber', '--lz-danger', '--lz-open-border', '--lz-ink-soft', '--lz-ink-muted', '--lz-line', '--lz-line-strong', '--lz-paper'];

  afterEach(() => tokens.forEach(t => (t in saved ? root.style.setProperty(t, saved[t]) : root.style.removeProperty(t))));

  it('resolves every colour from the live --lz-* custom properties', () => {
    tokens.forEach((t, i) => root.style.setProperty(t, `rgb(${i + 1}, 0, 0)`));
    const p = analyticsPalette();
    expect(p.seriesBlue).toBe('rgb(1, 0, 0)');
    expect(p.seriesGreen).toBe('rgb(2, 0, 0)');
    expect(p.statusWarning).toBe('rgb(3, 0, 0)');
    expect(p.statusCritical).toBe('rgb(4, 0, 0)');
    expect(p.coverageOpen).toBe('rgb(5, 0, 0)');
    expect(p.statusGood).toBe(p.seriesGreen);
    expect(p.surface).toBe('rgb(10, 0, 0)');
  });

  it('returns non-empty colours from the shipped tokens', () => {
    const p = analyticsPalette();
    Object.values(p).forEach(v => expect(String(v).length).toBeGreaterThan(0));
    expect(p.seriesBlue).toBe(getComputedStyle(root).getPropertyValue('--lz-link').trim());
  });

  it('follows a token change on the next call (no cached hex)', () => {
    root.style.setProperty('--lz-link', 'rgb(9, 9, 9)');
    expect(analyticsPalette().seriesBlue).toBe('rgb(9, 9, 9)');
    root.style.setProperty('--lz-link', 'rgb(8, 8, 8)');
    expect(analyticsPalette().seriesBlue).toBe('rgb(8, 8, 8)');
  });
});
