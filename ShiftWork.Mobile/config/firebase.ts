import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  inMemoryPersistence,
  type Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const REQUIRED_KEYS: Array<keyof typeof firebaseConfig> = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = REQUIRED_KEYS.filter((k) => !firebaseConfig[k]);
if (missing.length > 0) {
  console.warn('[Firebase] Missing config keys:', missing.join(', '));
}

// Guard against duplicate app initialization (hot reload / Fast Refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createAuth(): Auth {
  // Attempt 1: Full initialization with AsyncStorage persistence (best case)
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: any) {
    const isAlreadyInitialized =
      e?.code === 'auth/already-initialized' ||
      (typeof e?.message === 'string' && e.message.toLowerCase().includes('already initialized'));

    if (isAlreadyInitialized) {
      // Hot reload path — auth is already set up, just retrieve it
      return getAuth(app);
    }

    // Attempt 2: AsyncStorage unavailable or incompatible — fall back to in-memory.
    // Auth will still work; the user will need to re-login after an app restart.
    console.warn('[Firebase] AsyncStorage persistence failed, using in-memory auth:', e?.message);
    try {
      return initializeAuth(app, { persistence: inMemoryPersistence });
    } catch (e2: any) {
      const isAlreadyInit2 =
        e2?.code === 'auth/already-initialized' ||
        (typeof e2?.message === 'string' && e2.message.toLowerCase().includes('already initialized'));
      if (isAlreadyInit2) {
        return getAuth(app);
      }
      // If we get here, something is fundamentally broken with the Firebase setup.
      console.error('[Firebase] Auth initialization completely failed:', e2?.message);
      throw e2;
    }
  }
}

export const auth = createAuth();
export default app;
