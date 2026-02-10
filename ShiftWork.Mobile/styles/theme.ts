export const colors = {
  primary: '#4A90E2',
  primaryDark: '#2F6FB3',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#333333',
  muted: '#7A8796',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  border: '#E9ECEF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  subtitle: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
};
