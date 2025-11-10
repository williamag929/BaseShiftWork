import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { getActiveClockInAt } from '@/utils';
import { formatDate, formatTime } from '@/utils/date.utils';

export default function DashboardScreen() {
  const { companyId, personId, personFirstName, personLastName } = useAuthStore();
  const { isOnline, loading, hoursThisWeek, shiftsThisWeek, upcoming, recentEvents, error } = useDashboardData(companyId, personId);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);

  const isClockedIn = useMemo(() => {
    const latest = recentEvents?.[0];
    if (latest?.eventType === 'clock_in') return true;
    return !!activeClockInAt; // persisted fallback
  }, [recentEvents, activeClockInAt]);

  useEffect(() => {
    // derive start from recentEvents or persisted value
    const latest = recentEvents?.[0];
    (async () => {
      if (latest?.eventType === 'clock_in') {
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

  const fmtHM = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}`;
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.greeting}>{isOnline ? 'Good day!' : 'Offline Mode'}</Text>
        <Text style={styles.name}>
          {personId ? `${personFirstName ?? ''} ${personLastName ?? ''}`.trim() || `User #${personId}` : 'Please sign in'}
        </Text>
        {!isOnline && <Text style={styles.offlineNote}>You’re offline. Showing cached data.</Text>}
        {isClockedIn && (
          <Text style={styles.elapsed}>Time on clock: {fmtHM(elapsedSeconds)}</Text>
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
        <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
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
});
