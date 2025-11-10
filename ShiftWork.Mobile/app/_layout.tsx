import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getUserData, getCompanyId } from '@/utils/storage.utils';
// Initialize Firebase before any usage
import '@/config/firebase';

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

  useEffect(() => {
    // Hydrate auth state from secure storage on app start
    (async () => {
      try {
        const savedUser = await getUserData();
        const savedCompany = await getCompanyId();
        if (savedCompany) setCompanyId(savedCompany);
        if (savedUser?.personId) setPersonId(Number(savedUser.personId));
        if (savedUser?.email || savedUser?.firstName || savedUser?.lastName) {
          setPersonProfile({ email: savedUser?.email ?? null, firstName: savedUser?.firstName ?? null, lastName: savedUser?.lastName ?? null });
        }
        // If personal app and we have person, go to tabs by default
        // else stay on index/login
      } catch {
        // ignore
      }
    })();
  }, []);

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
