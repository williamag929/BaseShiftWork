import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/ui';
import { logger } from '@/utils/logger';
import { getToken, getUserData, getCompanyId } from '@/utils/storage.utils';

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

  // Restore auth state from SecureStore on cold start.
  // Firebase auth is DISABLED — we read the stored API JWT and user data instead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [token, userData, companyId] = await Promise.all([
          getToken(),
          getUserData(),
          getCompanyId(),
        ]);

        if (cancelled) return;

        if (token && userData) {
          setPersonId(Number(userData.personId));
          setPersonProfile({ email: userData.email ?? null, name: userData.name ?? null });
          if (companyId) setCompanyId(companyId);
          // Only redirect to dashboard on the very first mount
          if (!authInitialized.current) {
            router.replace('/(tabs)/dashboard' as any);
          }
        } else {
          setPersonId(null);
          setPersonProfile({ email: null, name: null, photoUrl: null });
        }
      } catch (e) {
        logger.warn('[Auth] Failed to restore auth from storage:', e);
      } finally {
        if (!cancelled) authInitialized.current = true;
      }
    })();
    return () => { cancelled = true; };
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
