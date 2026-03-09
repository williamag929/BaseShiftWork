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
