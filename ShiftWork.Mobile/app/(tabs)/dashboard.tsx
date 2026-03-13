import { StyleSheet, ScrollView, RefreshControl, AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Subscription } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { notificationService } from '@/services/notification.service';
import { peopleService } from '@/services/people.service';
import { logger } from '@/utils/logger';
import { colors } from '@/styles/tokens';
import { DashboardHeader } from '@/components/screens/dashboard/DashboardHeader';
import { ShiftBanner } from '@/components/screens/dashboard/ShiftBanner';
import { WeekStatsRow } from '@/components/screens/dashboard/WeekStatsRow';
import { QuickActions } from '@/components/screens/dashboard/QuickActions';
import { UpcomingShiftsSection } from '@/components/screens/dashboard/UpcomingShiftsSection';
import { RecentActivitySection } from '@/components/screens/dashboard/RecentActivitySection';
import { TimeOffSection } from '@/components/screens/dashboard/TimeOffSection';

export default function DashboardScreen() {
  const router = useRouter();
  const { companyId, personId, name } = useAuthStore();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  const data = useDashboardData(companyId, personId);
  const { isClockedIn, refresh, todayShift, todayShiftLocationName, recentEvents, error } = data;

  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationRef = useRef<Subscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);







  // Hydrate person name if missing
  useEffect(() => {
    (async () => {
      try {
        if (companyId && personId && !name) {
          const person = await peopleService.getPersonById(companyId, personId);
          if (person) {
            setPersonProfile({
              name: person.name ?? null,
              email: person.email ?? null,
            });
          }
        }
      } catch {}
    })();
  }, [companyId, personId, name, setPersonProfile]);





  // Polling, push-notification triggers, and app-state restore
  useEffect(() => {
    if (!companyId || !personId) return;
    const silentRefresh = () => {
      setSilentRefreshing(true);
      refresh().finally(() => setTimeout(() => setSilentRefreshing(false), 1000));
    };
    pollingRef.current = setInterval(() => {
      if (appStateRef.current === 'active') { logger.log('[Dashboard] Background poll...'); silentRefresh(); }
    }, 3 * 60 * 1000);
    notificationRef.current = notificationService.addNotificationReceivedListener((n) => {
      const type = n.request.content.data?.type;
      const triggers = ['schedule_published', 'shift_assigned', 'shift_changed', 'time_off_approved', 'time_off_denied'];
      if (typeof type === 'string' && triggers.includes(type)) { logger.log('[Dashboard] Notification refresh:', type); silentRefresh(); }
    });
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') { logger.log('[Dashboard] App resumed, refreshing...'); silentRefresh(); }
      appStateRef.current = next;
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (notificationRef.current) notificationRef.current.remove();
      sub.remove();
    };
  }, [companyId, personId, refresh]);



  return (
    <>
      <StatusBar style="light" />
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={refresh} />}>
        <DashboardHeader name={name} personId={personId} isOnline={data.isOnline} isClockedIn={isClockedIn} personStatus={data.personStatus} elapsedSeconds={data.elapsedSeconds} lastUpdated={data.lastUpdated} silentRefreshing={silentRefreshing} />
        {!!todayShift && (<ShiftBanner shift={todayShift} isClockedIn={isClockedIn} locationName={todayShiftLocationName} onPress={() => router.push('/(tabs)/clock' as any)} />)}
        <WeekStatsRow loading={data.loading} hoursThisWeek={data.hoursThisWeek} shiftsThisWeek={data.shiftsThisWeek} />
        <QuickActions isClockedIn={isClockedIn} onClock={() => router.push('/(tabs)/clock' as any)} onSchedule={() => router.push('/(tabs)/weekly-schedule' as any)} onTimeOff={() => router.push('/(tabs)/time-off-request' as any)} />
        <UpcomingShiftsSection loading={data.loading} upcoming={data.upcoming} onViewWeekly={() => router.push('/(tabs)/weekly-schedule' as any)} />
        <RecentActivitySection loading={data.loading} recentEvents={recentEvents} error={error} />
        <TimeOffSection loading={data.timeOffLoading} requests={data.timeOffRequests} onRequest={() => router.push('/(tabs)/time-off-request' as any)} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});


