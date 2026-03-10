import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { User } from 'firebase/auth';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/ui';
import { logger } from '@/utils/logger';
// Initialize Firebase before any usage
import '@/config/firebase';
import { auth } from '@/config/firebase';
import { authService } from '@/services';
import { saveUserData, saveCompanyId } from '@/utils/storage.utils';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const setCompanyId = useAuthStore((s) => s.setCompanyId);
  const setPersonId = useAuthStore((s) => s.setPersonId);
  const router = useRouter();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  // Track whether the initial auth check has completed to avoid redirect loops
  const authInitialized = useRef(false);

  // Initialize push notifications
  const { expoPushToken, error: notificationError, isRegistered } = useNotifications();

  useEffect(() => {
    if (isRegistered && expoPushToken) {
      logger.log('[Notifications] Registered with token:', expoPushToken);
    }
    if (notificationError) {
      logger.error('[Notifications] Registration error:', notificationError);
    }
  }, [isRegistered, expoPushToken, notificationError]);

  // Single authoritative auth listener.
  // - On app start: Firebase persistence re-hydrates; if user is found,
  //   fetch person via JWT (getCurrentUser) and redirect to dashboard.
  // - On login/logout: update store accordingly.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
        try {
          if (user) {
            // Fetch person data using Firebase JWT — avoids email-in-URL lookup
            const person = await authService.getCurrentUser();
            if (person?.personId && person?.companyId) {
              setCompanyId(person.companyId);
              setPersonId(Number(person.personId));
              setPersonProfile({ email: person.email ?? null, name: person.name ?? null });
              await saveUserData({ personId: person.personId, email: person.email, name: person.name });
              await saveCompanyId(person.companyId);
              // Redirect returning users to dashboard on cold start only
              if (!authInitialized.current) {
                router.replace('/(tabs)/dashboard' as any);
              }
            }
          } else {
            // User signed out — clear persisted store
            setPersonId(null);
            setPersonProfile({ email: null, name: null, photoUrl: null });
          }
        } catch (e) {
          logger.warn('[Auth] onAuthStateChanged: failed to fetch person:', e);
        } finally {
          authInitialized.current = true;
        }
      });
    } catch (e) {
      logger.error('[Auth] Failed to subscribe to onAuthStateChanged:', e);
      authInitialized.current = true;
    }
    return () => unsubscribe?.();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <ToastContainer />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
