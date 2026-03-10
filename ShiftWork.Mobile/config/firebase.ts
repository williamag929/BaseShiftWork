/**
 * Firebase configuration.
 * Firebase Auth is DISABLED — initializeAuth is never called so the
 * "Component auth has not been registered" crash cannot occur.
 *
 * The Firebase App is still initialized so that other Firebase services
 * (e.g. Firestore, Storage) can be used in the future if needed.
 * All auth is handled via direct API JWT tokens (see services/auth.service.ts).
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Guard against duplicate app initialization (hot reload / Fast Refresh)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── Auth stub ─────────────────────────────────────────────────────────────
// Firebase Auth is disabled. Exporting a lightweight stub so that any code
// that still references `auth` compiles without error and behaves safely:
//   • onAuthStateChanged(cb) → immediately calls cb(null) so guards that
//     check `if (user)` fall through to the "not logged in" path.
//   • currentUser → always null
//   • signOut() → resolves immediately
export const auth = {
  currentUser: null as null,
  onAuthStateChanged: (callback: (user: null) => void): (() => void) => {
    // Call once synchronously so listeners resolve instantly (no loading hang)
    try { callback(null); } catch { /* ignore */ }
    // Return a no-op unsubscribe
    return () => {};
  },
  signOut: async () => {},
} as const;

export default app;
