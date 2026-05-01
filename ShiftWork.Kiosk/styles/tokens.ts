// Design tokens — single source of truth for the kiosk UI.
// Apple Human Interface Guidelines inspired: OLED-optimized blacks, iOS system colors.

export const colors = {
  // Brand — iOS system blue (dark mode accessible #0A84FF)
  primary: '#0A84FF',
  primaryDark: '#0062CC',
  primaryLight: 'rgba(10,132,255,0.15)',

  // Backgrounds — true OLED black palette matching iOS dark mode
  background: '#000000',
  surface: '#1C1C1E',       // iOS grouped background
  surfaceElevated: '#2C2C2E', // iOS secondary fill
  surfaceBorder: 'rgba(84,84,88,0.65)', // iOS separator

  // Glass — frosted panel effect
  glass: 'rgba(44,44,46,0.92)',
  glassBorder: 'rgba(255,255,255,0.08)',
  separator: 'rgba(84,84,88,0.36)', // hairline divider

  // Text — iOS dark mode label hierarchy
  text: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.6)',  // secondary label
  textMuted: 'rgba(235,235,245,0.3)',      // tertiary label
  textOnPrimary: '#FFFFFF',

  // Status — Apple system colors (dark mode)
  success: '#30D158',                      // iOS system green
  successLight: 'rgba(48,209,88,0.15)',
  warning: '#FF9F0A',                      // iOS system orange
  warningLight: 'rgba(255,159,10,0.15)',
  danger: '#FF453A',                       // iOS system red
  dangerLight: 'rgba(255,69,58,0.15)',

  clockIn: '#30D158',
  clockOut: '#FF453A',

  overlay: 'rgba(0,0,0,0.72)',
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

export const typography = {
  // Apple type scale with exact letter-spacing values
  display: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -2 },
  h1:      { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },  // Large Title
  h2:      { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },  // Title 1
  h3:      { fontSize: 22, fontWeight: '600' as const, letterSpacing: 0.35 },  // Title 2
  title:   { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 }, // Headline
  body:    { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 }, // Body
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 }, // Callout
  label:   { fontSize: 15, fontWeight: '500' as const, letterSpacing: -0.24 }, // Subheadline
  footnote:{ fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 }, // Footnote
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },     // Caption 2
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
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
