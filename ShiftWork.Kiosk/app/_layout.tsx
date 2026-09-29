import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useDeviceStore } from '@/store/deviceStore';
import { colors } from '@/styles/tokens';
import { LocaleProvider } from '@/i18n';
import { startOutboxWorker } from '@/services/outbox';
import { startGeoRefresh } from '@/services/geo.service';
import { useConfigStore } from '@/store/configStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const loadFromStorage = useDeviceStore((s) => s.loadFromStorage);
  const isEnrolled = useDeviceStore((s) => s.isEnrolled);
  const companyId = useDeviceStore((s) => s.companyId);
  const locationId = useDeviceStore((s) => s.locationId);
  const loadCachedConfig = useConfigStore((s) => s.loadCached);

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

  // Load the saved offline queue and keep sending it for the life of the app.
  useEffect(() => startOutboxWorker(), []);

  // Once enrolled: apply this site's last-known PIN/photo switches (strict until known)
  // and keep a recent GPS fix so punches never wait on a location lookup.
  useEffect(() => {
    if (!isEnrolled) return undefined;
    void loadCachedConfig(companyId, locationId);
    return startGeoRefresh();
  }, [isEnrolled, companyId, locationId, loadCachedConfig]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <LocaleProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" backgroundColor={colors.background} />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </LocaleProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
