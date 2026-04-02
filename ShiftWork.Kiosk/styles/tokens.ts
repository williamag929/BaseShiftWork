// Design tokens — single source of truth for the kiosk UI.
// Dark, high-contrast palette suited for ambient tablet/kiosk environments.

export const colors = {
  // Brand
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',

  // Backgrounds (dark theme befitting a lobby kiosk)
  background: '#0F1923',
  surface: '#1A2636',
  surfaceElevated: '#1E2F45',
  surfaceBorder: '#263B55',

  // Text
  text: '#F0F4F8',
  textSecondary: '#94A9BF',
  textMuted: '#566D85',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',

  clockIn: '#16A34A',
  clockOut: '#EF4444',

  overlay: 'rgba(0,0,0,0.65)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 48, fontWeight: '700' as const, letterSpacing: -1 },
  h1: { fontSize: 36, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 28, fontWeight: '700' as const },
  h3: { fontSize: 22, fontWeight: '600' as const },
  title: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '500' as const },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
  },
} as const;

export const zIndex = {
  base: 0,
  card: 10,
  header: 20,
  overlay: 25,
  modal: 30,
  toast: 40,
} as const;
