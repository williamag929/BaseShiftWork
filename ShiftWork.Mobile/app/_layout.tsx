import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getUserData, getCompanyId } from '@/utils/storage.utils';
import { useNotifications } from '@/hooks/useNotifications';
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

  // Initialize push notifications
  const { expoPushToken, error: notificationError, isRegistered } = useNotifications();

  useEffect(() => {
    if (isRegistered && expoPushToken) {
      console.log('Push notifications registered with token:', expoPushToken);
    }
    if (notificationError) {
      console.error('Push notification error:', notificationError);
    }
  }, [isRegistered, expoPushToken, notificationError]);

  useEffect(() => {
    // Hydrate auth state from secure storage on app start
    (async () => {
      try {
        const savedUser = await getUserData();
        const savedCompany = await getCompanyId();
        if (savedCompany) setCompanyId(savedCompany);
        if (savedUser?.personId) setPersonId(Number(savedUser.personId));
        if (savedUser?.email || savedUser?.name) {
          setPersonProfile({ email: savedUser?.email ?? null, name: savedUser?.name ?? null });
        }
        // If personal app and we have person, go to tabs by default
        // else stay on index/login
      } catch {
        // ignore
      }
    })();
  }, []);

  // When Firebase auth is enabled, map user -> person automatically
  useEffect(() => {
    const unsubscribe = auth?.onAuthStateChanged?.(async (user: any) => {
      try {
        if (user?.email) {
          const person = await authService.getUserByEmail(user.email);
          if (person?.personId && person?.companyId) {
            setCompanyId(person.companyId);
            setPersonId(Number(person.personId));
            setPersonProfile({ email: person.email, name: person.name });
            await saveUserData({ personId: person.personId, email: person.email, name: person.name });
            await saveCompanyId(person.companyId);
          }
        }
      } catch (e) {
        console.warn('Failed to map auth user to person:', e);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [setCompanyId, setPersonId, setPersonProfile]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
