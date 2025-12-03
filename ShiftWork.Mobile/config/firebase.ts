// Firebase configuration
import { initializeApp, getApps } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app (only once)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Lazy initialization of auth to avoid race conditions
let _auth: Auth | undefined;

function getFirebaseAuth(): Auth {
  if (_auth) {
    return _auth;
  }
  
  try {
    // Try to get existing auth instance
    _auth = getAuth(app);
  } catch (error) {
    // If it doesn't exist, initialize with React Native persistence
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  }
  
  return _auth;
}

// Export a getter that lazily initializes auth
export const auth = new Proxy({} as Auth, {
  get: (target, prop) => {
    const authInstance = getFirebaseAuth();
    return (authInstance as any)[prop];
  }
});

export default app;
