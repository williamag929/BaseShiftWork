/**
 * Apple iOS Design System — ShiftWork Mobile
 * Aligned with iOS 17 Human Interface Guidelines.
 * systemBlue, system grays, grouped background semantics.
 */
export const colors = {
  // Primary action — iOS systemBlue
  primary: '#007AFF',
  primaryDark: '#0056CC',
  primaryLight: '#E8F2FF',

  // Semantic surfaces (iOS system backgrounds)
  background: '#F2F2F7',         // systemGroupedBackground
  surface: '#FFFFFF',             // secondarySystemGroupedBackground card
  surfaceRaised: '#FFFFFF',       // elevated card surface

  // Text hierarchy (iOS label colors)
  text: '#000000',                // label
  textSecondary: '#3C3C43',       // secondaryLabel (at 0.6 opacity → ~#636366)
  muted: '#8E8E93',               // tertiaryLabel

  // System fills
  fill: 'rgba(120,120,128,0.12)', // systemFill
  fillSecondary: 'rgba(120,120,128,0.08)',

  // Semantic colors
  success: '#34C759',             // systemGreen
  successLight: 'rgba(52,199,89,0.12)',
  warning: '#FF9500',             // systemOrange
  warningLight: 'rgba(255,149,0,0.12)',
  danger: '#FF3B30',              // systemRed
  dangerLight: 'rgba(255,59,48,0.12)',
  info: '#5856D6',                // systemPurple

  // Separators
  border: 'rgba(60,60,67,0.18)', // separator
  borderOpaque: '#C6C6C8',        // opaqueSeparator

  // Inverted (for headers on dark bg)
  onPrimary: '#FFFFFF',
  onDanger: '#FFFFFF',
  onSuccess: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 20,        // standard iOS grouped section padding
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 13,             // iOS card corner radius
  xl: 16,
  xxl: 22,            // bottom sheet, large modals
  pill: 9999,
};

export const typography = {
  // iOS type scale
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1:     { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2:     { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3:     { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline:   { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.43 },
  body:       { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.43 },
  callout:    { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead:    { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote:   { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption:    { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  caption2:   { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.07 },

  // Legacy aliases so existing imports don't break
  title:    { fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontSize: 17, fontWeight: '600' as const },
};

export const shadow = {
  // iOS-style shadow: very subtle, short offset
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inset: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 0,
    elevation: 0,
  },
};
