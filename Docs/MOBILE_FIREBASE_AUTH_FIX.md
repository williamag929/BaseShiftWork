# Mobile Firebase Authentication - Known Issue & Resolution

## ✅ RESOLVED — 2026-03-05

**Branch:** `feature/mobile-firebase-auth-fix` (commits `149ae6c`, `b6c76c0`)  
**Solution applied:** Option 1 — downgrade to `firebase@9.23.0` + `initializeAuth` with AsyncStorage persistence  
**PR:** https://github.com/williamag929/BaseShiftWork/compare/main...feature/mobile-firebase-auth-fix?expand=1

---

## Issue Summary
Firebase 10.x has a critical bug in React Native/Expo environments that prevents proper initialization:
```
Error: Component auth has not been registered yet
```

This error occurs when calling `initializeAuth()` in React Native contexts, making it impossible to use real Firebase authentication in the mobile app.

## ~~Current Workaround~~ — No Longer Active

**Status:** ❌ REMOVED — replaced by real Firebase Auth

<details>
<summary>Previous workaround (kept for reference)</summary>

### How It Worked
1. **Mock Firebase Auth Object** - `config/firebase.ts`
   - `auth.currentUser` always returned `null`
   - Prevented app crashes from initialization errors

2. **Development Token Fallback** - `.env`
   - Used `EXPO_PUBLIC_DEV_TOKEN` environment variable
   - Added to all API requests when no user was logged in

3. **Smart Token Management** - `services/api-client.ts`
   - Checked for `auth.currentUser` (always null with mock)
   - Fell back to dev token from environment

</details>

## For Future Fixes

### Option 1: Downgrade Firebase to 9.x — ✅ IMPLEMENTED

**Completed 2026-03-05.** Changes made:

```bash
cd ShiftWork.Mobile
npm uninstall firebase
npm install firebase@9.23.0  # --legacy-peer-deps
```

`config/firebase.ts` now contains (with env-var validation added after reviewer pass):
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

Additional files updated:
- `app/(auth)/login.tsx` — real `signInWithEmailAndPassword` call
- `app/(auth)/register.tsx` — real `createUserWithEmailAndPassword`; real Firebase UID sent to API
- `store/authStore.ts` — `signOut` calls `firebaseSignOut(auth)`
- `utils/firebase-error.utils.ts` — centralised Firebase error code → user-friendly message mapping

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

## Implementation Checklist — ✅ COMPLETE

**Before Updating:**
- [x] Test current app works with dev token
- [x] Confirm API is accessible
- [x] Backup current `.env` values
- [x] Test on both iOS and Android if possible

**After Upgrading Firebase:**
- [x] Remove mock auth from [config/firebase.ts](./ShiftWork.Mobile/config/firebase.ts)
- [x] Implement proper `initializeAuth()` with persistence
- [x] `api-client.ts` already used `getIdToken()` — works automatically once `currentUser` is non-null
- [x] Login flow updated (`signInWithEmailAndPassword` before API profile fetch)
- [x] Registration flow updated (real Firebase UID)
- [x] `signOut` clears Firebase persisted session
- [ ] Remove/deprecate `EXPO_PUBLIC_DEV_TOKEN` from `.env` (can be done after full E2E test on device)
- [ ] Test token auto-refresh works on device
- [ ] Test logout and re-login flows on device

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
