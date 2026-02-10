import { ShiftEventTypes } from '@/types/api';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, AppState, AppStateStatus } from 'react-native';
import { useEffect, useMemo, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { getActiveClockInAt } from '@/utils';
import { formatDate, formatTime } from '@/utils/date.utils';
import { timeOffRequestService, TimeOffRequest } from '@/services/time-off-request.service';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/services/notification.service';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, SectionHeader } from '@/components/ui';
import { colors } from '@/styles/theme';
import { peopleService } from '@/services/people.service';

export default function DashboardScreen() {
  const router = useRouter();
  const { companyId, personId, name } = useAuthStore();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  const { isOnline, loading, refreshing, hoursThisWeek, shiftsThisWeek, upcoming, recentEvents, personStatus, error, refresh, lastUpdated } = useDashboardData(companyId, personId);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [timeOffLoading, setTimeOffLoading] = useState(false);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isClockedIn = useMemo(() => {
    const latest = recentEvents?.[0];
    if (latest?.eventType === ShiftEventTypes.ClockIn) return true;
    return !!activeClockInAt; // persisted fallback
  }, [recentEvents, activeClockInAt]);

  const nextShift = useMemo(() => (upcoming?.length ? upcoming[0] : null), [upcoming]);

  useEffect(() => {
    // derive start from recentEvents or persisted value
    const latest = recentEvents?.[0];
    (async () => {
      if (latest?.eventType === ShiftEventTypes.ClockIn) {
        setActiveClockInAt(new Date(latest.eventDate));
      } else {
        const saved = await getActiveClockInAt();
        setActiveClockInAt(saved ? new Date(saved) : null);
      }
    })();
  }, [recentEvents]);

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

  useEffect(() => {
    if (!isClockedIn || !activeClockInAt) {
      setElapsedSeconds(0);
      return;
    }
    const update = () => {
      const ms = Date.now() - activeClockInAt.getTime();
      setElapsedSeconds(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isClockedIn, activeClockInAt]);

  // Load time off requests
  useEffect(() => {
    if (companyId && personId) {
      setTimeOffLoading(true);
      Promise.all([
  timeOffRequestService.getPendingTimeOff(companyId, personId),
  timeOffRequestService.getUpcomingTimeOff(companyId, personId)
      ])
        .then(([pending, upcoming]) => {
          // Combine and deduplicate
          const combined = [...pending, ...upcoming];
          const unique = combined.filter((item, index, self) =>
            index === self.findIndex(t => t.timeOffRequestId === item.timeOffRequestId)
          );
          setTimeOffRequests(unique.sort((a, b) => 
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          ));
        })
        .catch(err => console.error('Error loading time off:', err))
        .finally(() => setTimeOffLoading(false));
    }
  }, [companyId, personId]);

  // Setup polling and notification listeners for real-time updates
  useEffect(() => {
    if (!companyId || !personId) return;

    // Start background polling (every 3 minutes)
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(() => {
        if (appStateRef.current === 'active') {
          console.log('Background polling: refreshing dashboard...');
          setSilentRefreshing(true);
          refresh().finally(() => {
            setTimeout(() => setSilentRefreshing(false), 1000);
          });
        }
      }, 3 * 60 * 1000); // 3 minutes
    };

    startPolling();

    // Listen for push notifications about shift/schedule changes
    notificationListenerRef.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'schedule_published' || 
            data?.type === 'shift_assigned' || 
            data?.type === 'shift_changed' ||
            data?.type === 'time_off_approved' ||
            data?.type === 'time_off_denied') {
          console.log('Dashboard update notification received, refreshing...');
          setSilentRefreshing(true);
          refresh().finally(() => {
            setTimeout(() => setSilentRefreshing(false), 1000);
          });
        }
      }
    );

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh dashboard
        console.log('App resumed, refreshing dashboard...');
        setSilentRefreshing(true);
        refresh().finally(() => {
          setTimeout(() => setSilentRefreshing(false), 1000);
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(notificationListenerRef.current);
      }
      subscription.remove();
    };
  }, [companyId, personId, refresh]);

  const fmtHM = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}`;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.greeting}>{isOnline ? 'Good day!' : 'Offline Mode'}</Text>
        <Text style={styles.name}>
          {personId
            ? name || `User #${personId}`
            : 'Please sign in'}
        </Text>
        <View style={styles.pillRow}>
          <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
            <Text style={styles.pillText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          {isClockedIn && (
            <View style={[styles.pill, styles.pillOnClock]}>
              <Text style={styles.pillText}>On Clock</Text>
            </View>
          )}
        </View>
        {!isOnline && <Text style={styles.offlineNote}>You're offline. Showing cached data.</Text>}
        {!!personStatus && (
          <Text style={styles.offlineNote}>Status: {personStatus}</Text>
        )}
        {isClockedIn && (
          <Text style={styles.elapsed}>Time on clock: {fmtHM(elapsedSeconds)}</Text>
        )}
        {lastUpdated && (
          <View style={styles.updateRow}>
            <Text style={styles.lastUpdated}>Last updated: {formatTime(lastUpdated.toISOString())}</Text>
            {silentRefreshing && (
              <View style={styles.syncIndicator}>
                <Ionicons name="sync" size={14} color={colors.primary} />
                <Text style={styles.syncText}>Syncing...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{loading ? '—' : hoursThisWeek.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Hours This Week</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{loading ? '—' : shiftsThisWeek}</Text>
          <Text style={styles.statLabel}>Shifts This Week</Text>
        </Card>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/clock' as any)}>
          <Ionicons name="time" size={18} color={colors.primary} />
          <Text style={styles.quickActionText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/weekly-schedule' as any)}>
          <Ionicons name="calendar" size={18} color={colors.primary} />
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/time-off-request' as any)}>
          <Ionicons name="airplane" size={18} color={colors.primary} />
          <Text style={styles.quickActionText}>Time Off</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next Shift</Text>
        {loading && <ActivityIndicator />}
        {!loading && !nextShift && (
          <EmptyState
            title="No upcoming shifts"
            message="Check your schedule or ask a manager if you need an update."
            icon="calendar-outline"
          />
        )}
        {!loading && nextShift && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{formatDate(nextShift.startDate)}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(nextShift.startDate)} - {formatTime(nextShift.endDate)}</Text>
            <Text style={styles.cardLocation}>Shift #{nextShift.scheduleShiftId}</Text>
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Upcoming Shifts"
          rightSlot={
            <TouchableOpacity onPress={() => router.push('/(tabs)/weekly-schedule' as any)}>
              <Text style={styles.requestButton}>View Weekly</Text>
            </TouchableOpacity>
          }
        />
        {loading && <ActivityIndicator />}
        {!loading && upcoming.length === 0 && (
          <View style={styles.emptyRow}>
            <Ionicons name="calendar-clear-outline" size={18} color="#8E99A8" />
            <Text style={styles.emptyInlineText}>No upcoming shifts</Text>
          </View>
        )}
        {!loading && upcoming.map((s) => (
          <Card key={s.scheduleShiftId} style={styles.card}>
            <Text style={styles.cardTitle}>{formatDate(s.startDate)}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(s.startDate)} - {formatTime(s.endDate)}</Text>
            <Text style={styles.cardLocation}>Shift #{s.scheduleShiftId}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {loading && <ActivityIndicator />}
        {!loading && recentEvents.length === 0 && (
          <View style={styles.emptyRow}>
            <Ionicons name="pulse-outline" size={18} color="#8E99A8" />
            <Text style={styles.emptyInlineText}>No recent activity</Text>
          </View>
        )}
        {!loading && recentEvents.map((e) => (
          <Card key={e.eventLogId} style={styles.card}>
            <Text style={styles.cardText}>{e.eventType.replace('_', ' ')}</Text>
            <Text style={styles.cardDate}>{formatDate(e.eventDate)} {formatTime(e.eventDate)}</Text>
          </Card>
        ))}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Time Off"
          rightSlot={
            <TouchableOpacity 
              style={styles.requestButton}
              onPress={() => router.push('/(tabs)/time-off-request' as any)}
            >
              <Text style={styles.requestButtonText}>+ Request</Text>
            </TouchableOpacity>
          }
        />
        {timeOffLoading && <ActivityIndicator />}
        {!timeOffLoading && timeOffRequests.length === 0 && (
          <View>
            <EmptyState
              title="No time off scheduled"
              message="Submit a request to notify your manager."
              icon="airplane-outline"
            />
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => router.push('/(tabs)/time-off-request' as any)}
            >
              <Text style={styles.linkButtonText}>Request Time Off</Text>
            </TouchableOpacity>
          </View>
        )}
        {!timeOffLoading && timeOffRequests.map((req) => (
          <Card key={req.timeOffRequestId} style={[
            styles.card,
            req.status === 'Approved' && styles.cardApproved,
            req.status === 'Denied' && styles.cardDenied,
            req.status === 'Pending' && styles.cardPending
          ]}>
            <View style={styles.timeOffHeader}>
              <Text style={styles.cardTitle}>{req.type}</Text>
              <View style={[
                styles.statusBadge,
                req.status === 'Approved' && styles.statusApproved,
                req.status === 'Denied' && styles.statusDenied,
                req.status === 'Pending' && styles.statusPending
              ]}>
                <Text style={styles.statusText}>{req.status}</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              {formatDate(req.startDate)} - {formatDate(req.endDate)}
            </Text>
            {req.hoursRequested && (
              <Text style={styles.cardHours}>{req.hoursRequested} hours</Text>
            )}
            {req.reason && (
              <Text style={styles.cardReason}>{req.reason}</Text>
            )}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: 0,
    paddingBottom: 30,
  },
  greeting: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  offlineNote: { color: '#fff', opacity: 0.8, marginTop: 4 },
  lastUpdated: { color: '#fff', opacity: 0.7, marginTop: 4, fontSize: 12 },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOnline: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillOffline: {
    backgroundColor: 'rgba(231, 76, 60, 0.25)',
  },
  pillOnClock: {
    backgroundColor: 'rgba(39, 174, 96, 0.25)',
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 14,
    color: colors.primary,
  },
  cardText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  emptyInlineText: {
    color: '#7A8796',
    fontSize: 13,
  },
  cardDate: {
    fontSize: 12,
    color: colors.muted,
  },
  errorText: { color: colors.danger, marginTop: 8 },
  elapsed: { color: '#fff', marginTop: 6, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  linkButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  timeOffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: colors.success,
  },
  statusDenied: {
    backgroundColor: colors.danger,
  },
  statusPending: {
    backgroundColor: colors.warning,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardApproved: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  cardDenied: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  cardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  cardHours: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  cardReason: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
});
