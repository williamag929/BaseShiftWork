/**
 * Design Tokens — single source of truth for all UI values.
 * Re-exports everything from theme.ts and adds extra tokens.
 * Always import from here, never from theme.ts directly.
 */
export { colors, spacing, radius, typography, shadow } from './theme';

// Z-index scale
export const zIndex = {
  base: 0,
  card: 10,
  header: 20,
  overlay: 25,
  modal: 30,
  toast: 40,
} as const;

// Named animation durations (ms)
export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// Minimum accessible touch target size
export const touchTarget = {
  min: 44,
} as const;

// iOS-style blur tints (for BlurView or tinted overlays)
export const blur = {
  light: 'rgba(255,255,255,0.72)',
  dark: 'rgba(0,0,0,0.40)',
  chrome: 'rgba(242,242,247,0.80)',
} as const;

// Gradient definitions (start/end for LinearGradient)
export const gradients = {
  primary: ['#007AFF', '#0056CC'] as const,
  success: ['#34C759', '#248A3D'] as const,
  danger:  ['#FF3B30', '#C93028'] as const,
  surface: ['#FFFFFF', '#F8F8FA'] as const,
} as const;
