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

export default function DashboardScreen() {
  const router = useRouter();
  const { companyId, personId, personFirstName, personLastName } = useAuthStore();
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
          {personId ? `${personFirstName ?? ''} ${personLastName ?? ''}`.trim() || `User #${personId}` : 'Please sign in'}
        </Text>
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
                <Ionicons name="sync" size={14} color="#4A90E2" />
                <Text style={styles.syncText}>Syncing...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{loading ? '—' : hoursThisWeek.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Hours This Week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{loading ? '—' : shiftsThisWeek}</Text>
          <Text style={styles.statLabel}>Shifts This Week</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/weekly-schedule' as any)}>
            <Text style={styles.requestButton}>View Weekly</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator />}
        {!loading && upcoming.length === 0 && (
          <View style={styles.card}><Text style={styles.cardText}>No upcoming shifts</Text></View>
        )}
        {!loading && upcoming.map((s) => (
          <View key={s.scheduleShiftId} style={styles.card}>
            <Text style={styles.cardTitle}>{formatDate(s.startDate)}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(s.startDate)} - {formatTime(s.endDate)}</Text>
            <Text style={styles.cardLocation}>Shift #{s.scheduleShiftId}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {loading && <ActivityIndicator />}
        {!loading && recentEvents.length === 0 && (
          <View style={styles.card}><Text style={styles.cardText}>No recent activity</Text></View>
        )}
        {!loading && recentEvents.map((e) => (
          <View key={e.eventLogId} style={styles.card}>
            <Text style={styles.cardText}>{e.eventType.replace('_', ' ')}</Text>
            <Text style={styles.cardDate}>{formatDate(e.eventDate)} {formatTime(e.eventDate)}</Text>
          </View>
        ))}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Time Off</Text>
          <TouchableOpacity 
            style={styles.requestButton}
            onPress={() => router.push('/(tabs)/time-off-request' as any)}
          >
            <Text style={styles.requestButtonText}>+ Request</Text>
          </TouchableOpacity>
        </View>
        {timeOffLoading && <ActivityIndicator />}
        {!timeOffLoading && timeOffRequests.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardText}>No time off scheduled</Text>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => router.push('/(tabs)/time-off-request' as any)}
            >
              <Text style={styles.linkButtonText}>Request Time Off</Text>
            </TouchableOpacity>
          </View>
        )}
        {!timeOffLoading && timeOffRequests.map((req) => (
          <View key={req.timeOffRequestId} style={[
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
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4A90E2',
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#4A90E2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
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
    color: '#333',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 14,
    color: '#4A90E2',
  },
  cardText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
  },
  errorText: { color: '#E74C3C', marginTop: 8 },
  elapsed: { color: '#fff', marginTop: 6, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestButton: {
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#27AE60',
  },
  statusDenied: {
    backgroundColor: '#E74C3C',
  },
  statusPending: {
    backgroundColor: '#F39C12',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardApproved: {
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
  },
  cardDenied: {
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  cardPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  cardHours: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  cardReason: {
    fontSize: 13,
    color: '#666',
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
