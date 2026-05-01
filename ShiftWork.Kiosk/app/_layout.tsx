import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useDeviceStore } from '@/store/deviceStore';
import { colors } from '@/styles/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const loadFromStorage = useDeviceStore((s) => s.loadFromStorage);

  // Restore enrollment from SecureStore on cold start
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Keep the tablet screen awake at all times
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" backgroundColor={colors.background} />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
