/**
 * Logger utility — all console output is guarded to dev builds only.
 * Use this instead of console.log / console.error / console.warn anywhere
 * in app/ and services/ to prevent log leakage in production.
 */
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
  },
};
