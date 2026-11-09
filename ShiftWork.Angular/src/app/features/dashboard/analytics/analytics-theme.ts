export interface AnalyticsColors {
  seriesBlue: string;
  seriesGreen: string;
  coverageOpen: string;
  statusGood: string;
  statusWarning: string;
  statusCritical: string;
  inkSecondary: string;
  muted: string;
  gridline: string;
  axis: string;
  surface: string;
}

/**
 * ECharts draws on canvas and cannot read CSS variables, so every colour is resolved from the
 * design tokens when a chart is built. Call it per build (not once at load) so a token change is picked up.
 */
export function analyticsPalette(root: HTMLElement = document.documentElement): AnalyticsColors {
  const style = getComputedStyle(root);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    seriesBlue: token('--lz-link'),
    seriesGreen: token('--lz-success'),
    coverageOpen: token('--lz-open-border'),
    statusGood: token('--lz-success'),
    statusWarning: token('--lz-amber'),
    statusCritical: token('--lz-danger'),
    inkSecondary: token('--lz-ink-soft'),
    muted: token('--lz-ink-muted'),
    gridline: token('--lz-line'),
    axis: token('--lz-line-strong'),
    surface: token('--lz-paper'),
  };
}
