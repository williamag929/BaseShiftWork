import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/tokens';

interface DashboardHeaderProps {
  name: string | null;
  personId: number | null;
  isOnline: boolean;
  isClockedIn: boolean;
  personStatus?: string | null;
  elapsedSeconds: number;
  lastUpdated: Date | null;
  silentRefreshing: boolean;
}

function fmtHM(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}

export function DashboardHeader({
  name, personId, isOnline, isClockedIn, personStatus,
  elapsedSeconds, lastUpdated, silentRefreshing,
}: DashboardHeaderProps) {
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.header}>
      <Text style={styles.greeting}>{isOnline ? 'Good day!' : 'Offline Mode'}</Text>
      <Text style={styles.name}>{personId ? name || `User #${personId}` : 'Please sign in'}</Text>
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
      {!!personStatus && <Text style={styles.offlineNote}>Status: {personStatus}</Text>}
      {isClockedIn && <Text style={styles.elapsed}>Time on clock: {fmtHM(elapsedSeconds)}</Text>}
      {lastUpdated && (
        <View style={styles.updateRow}>
          <Text style={styles.lastUpdated}>Last updated: {fmtTime(lastUpdated)}</Text>
          {silentRefreshing && (
            <View style={styles.syncIndicator}>
              <Ionicons name="sync" size={14} color={colors.primary} />
              <Text style={styles.syncText}>Syncing...</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, padding: 20, paddingTop: 0, paddingBottom: 30 },
  greeting: { fontSize: 16, color: '#fff', opacity: 0.9 },
  name: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  offlineNote: { color: '#fff', opacity: 0.8, marginTop: 4 },
  lastUpdated: { color: '#fff', opacity: 0.7, marginTop: 4, fontSize: 12 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillOnline: { backgroundColor: 'rgba(255,255,255,0.2)' },
  pillOffline: { backgroundColor: 'rgba(231,76,60,0.25)' },
  pillOnClock: { backgroundColor: 'rgba(39,174,96,0.25)' },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  elapsed: { color: '#fff', marginTop: 6, fontWeight: '600' },
  updateRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 6,
  },
  syncIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  syncText: { fontSize: 11, color: '#fff', fontWeight: '500' },
});
