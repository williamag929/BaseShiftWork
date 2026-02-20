// Firebase configuration - DISABLED DUE TO REACT NATIVE BUG
// Firebase 10.x has a critical bug with React Native/Expo: "Component auth has not been registered yet"
// This prevents initializeAuth() from working in React Native environments
// 
// WORKAROUND: Use a mock auth object that allows graceful fallback to dev tokens
// TODO: Either downgrade to Firebase 9.x or wait for Firebase to fix the React Native integration

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock auth object that provides the same interface as Firebase Auth
// This allows the app to run without crashing
export const auth = {
  currentUser: null, // No user when mock auth is used
  onAuthStateChanged: (callback: (user: any) => void) => {
    // Simulate checking for previously stored auth
    AsyncStorage.getItem('firebase_user').then(user => {
      callback(user ? JSON.parse(user) : null);
    });
    return () => {}; // Unsubscribe function
  },
  signInWithEmailAndPassword: async (email: string, password: string) => {
    throw new Error('Firebase auth is not available. Using dev token instead.');
  },
  signOut: async () => {
    await AsyncStorage.removeItem('firebase_user');
  },
} as any;

export default null;
