# Mobile Firebase Authentication - Known Issue & Workaround

## Issue Summary
Firebase 10.x has a critical bug in React Native/Expo environments that prevents proper initialization:
```
Error: Component auth has not been registered yet
```

This error occurs when calling `initializeAuth()` in React Native contexts, making it impossible to use real Firebase authentication in the mobile app.

## Current Workaround
**Status:** ✅ IMPLEMENTED AND WORKING

### How It Works
1. **Mock Firebase Auth Object** - [config/firebase.ts](./ShiftWork.Mobile/config/firebase.ts)
   - Provides same interface as Firebase Auth
   - `auth.currentUser` always returns `null` (no user logged in)
   - Prevents app crashes from initialization errors

2. **Development Token Fallback** - [.env](./ShiftWork.Mobile/.env)
   - Uses `EXPO_PUBLIC_DEV_TOKEN` environment variable
   - Automatically added to all API requests when no user is logged in
   - Token is a valid Firebase JWT that expires after ~1 hour

3. **Smart Token Management** - [services/api-client.ts](./ShiftWork.Mobile/services/api-client.ts)
   - Checks for `auth.currentUser` (always null with current setup)
   - Falls back to dev token from environment
   - Logs authentication details for debugging

## For Future Fixes

### Option 1: Downgrade Firebase to 9.x (RECOMMENDED)
```bash
cd ShiftWork.Mobile
npm uninstall firebase
npm install firebase@9.x
```

Then update [config/firebase.ts](./ShiftWork.Mobile/config/firebase.ts):
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Use initializeAuth with persistence for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { auth };
export default app;
```

### Option 2: Wait for Firebase to Fix React Native Support
- Track issue: [Firebase GitHub Issues](https://github.com/firebase/firebase-js-sdk/issues)
- Monitor Firebase release notes
- Update when fixed in v11+

### Option 3: Use Alternative Auth Provider
- Consider Supabase, AWS Cognito, or Auth0
- Would require updating backend authentication (currently uses Firebase JWT)

## Testing with Current Setup

### Using Dev Token
1. Dev token is automatically used from `.env`
2. Token must be valid and not expired (expires after ~1 hour)
3. Get fresh token from Angular frontend:
   - Open http://localhost:4200 in browser
   - Open DevTools Console (F12)
   - Run: `auth.currentUser.getIdToken().then(token => console.log(token))`
   - Copy new token and update `.env`

### Configuration Reference

**Mobile App .env:**
```
EXPO_PUBLIC_API_URL=http://192.168.1.68:5182
EXPO_PUBLIC_DEV_TOKEN=<valid-firebase-jwt>
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

**API CORS (Program.cs):**
```csharp
// Allows Expo dev server on localhost:8081
builder.WithOrigins("http://localhost:8081", ...)
```

**Login Screen:**
- Currently disabled with mock auth
- Ready to implement once Firebase auth is fixed
- Location: [app/(auth)/login.tsx](./ShiftWork.Mobile/app/(auth)/login.tsx)

## Implementation Checklist for Future Fix

✅ **Before Updating:**
- [ ] Test current app works with dev token
- [ ] Confirm API is accessible
- [ ] Backup current `.env` values
- [ ] Test on both iOS and Android if possible

✅ **After Upgrading Firebase:**
- [ ] Remove mock auth from [config/firebase.ts](./ShiftWork.Mobile/config/firebase.ts)
- [ ] Implement proper `initializeAuth()` with persistence
- [ ] Update [services/api-client.ts](./ShiftWork.Mobile/services/api-client.ts) to use real `getIdToken()`
- [ ] Test login flow thoroughly
- [ ] Remove/deprecate `EXPO_PUBLIC_DEV_TOKEN` from `.env`
- [ ] Test token auto-refresh works
- [ ] Test logout and re-login flows

## Related Files
- **Firebase Config:** [ShiftWork.Mobile/config/firebase.ts](./ShiftWork.Mobile/config/firebase.ts)
- **API Client:** [ShiftWork.Mobile/services/api-client.ts](./ShiftWork.Mobile/services/api-client.ts)
- **Environment:** [ShiftWork.Mobile/.env](./ShiftWork.Mobile/.env)
- **Backend Auth:** [ShiftWork.Api/Program.cs](./ShiftWork.Api/Program.cs) (lines 122-141)
- **Login Screen:** [ShiftWork.Mobile/app/(auth)/login.tsx](./ShiftWork.Mobile/app/(auth)/login.tsx)

## References
- Firebase React Native docs: https://firebase.google.com/docs/auth/start
- Expo docs: https://docs.expo.dev/
- Firebase bug tracker: https://github.com/firebase/firebase-js-sdk/issues
