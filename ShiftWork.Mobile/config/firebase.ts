// Firebase configuration - TEMPORARILY DISABLED
// There's a critical bug with Firebase 10.x and React Native where the auth component
// cannot be initialized ("Component auth has not been registered yet")
// 
// TODO: Either downgrade to Firebase 9.x or wait for Firebase to fix this issue
// For now, we'll use a mock auth object to prevent crashes

// Mock auth object to prevent crashes
export const auth = {
  currentUser: null,
  onAuthStateChanged: () => () => {},
  signInWithEmailAndPassword: async () => { throw new Error('Firebase auth is disabled'); },
  signOut: async () => { throw new Error('Firebase auth is disabled'); },
  // Add other methods as needed
} as any;

export default null;
