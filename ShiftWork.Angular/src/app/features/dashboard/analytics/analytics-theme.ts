/**
 * ECharts theme + palette for the analytics dashboard.
 * Colors are the validated data-viz reference palette (CVD-safe in the pairs used):
 *  - series blue + green for worked/scheduled/variance
 *  - blue + orange for coverage filled/open
 *  - reserved status palette (good/warning/critical) for attendance, always with labels
 *  - single-hue blue sequential ramp for the coverage heatmap
 */
export const AnalyticsPalette = {
  seriesBlue: '#2a78d6',
  seriesGreen: '#008300',
  coverageOpen: '#eb6834',
  statusGood: '#0ca30c',
  statusWarning: '#fab219',
  statusCritical: '#d03b3b',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#fcfcfb',
  // Sequential blue ramp (near-zero → dense) for the heatmap
  sequential: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
} as const;

export const ANALYTICS_ECHARTS_THEME = {
  color: [AnalyticsPalette.seriesBlue, AnalyticsPalette.seriesGreen, AnalyticsPalette.coverageOpen],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: AnalyticsPalette.inkSecondary },
  title: { textStyle: { color: AnalyticsPalette.ink, fontWeight: 600 } },
  grid: { top: 40, right: 16, bottom: 32, left: 48, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: AnalyticsPalette.axis } },
    axisTick: { show: false },
    axisLabel: { color: AnalyticsPalette.muted },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: AnalyticsPalette.muted },
    splitLine: { lineStyle: { color: AnalyticsPalette.gridline } },
  },
  legend: { textStyle: { color: AnalyticsPalette.inkSecondary }, icon: 'roundRect', itemWidth: 12, itemHeight: 12 },
  line: { lineStyle: { width: 2 }, symbolSize: 8, smooth: false },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#ffffff',
    borderColor: AnalyticsPalette.gridline,
    borderWidth: 1,
    textStyle: { color: AnalyticsPalette.ink },
  },
};

export const ANALYTICS_THEME_NAME = 'shiftwork-analytics';
