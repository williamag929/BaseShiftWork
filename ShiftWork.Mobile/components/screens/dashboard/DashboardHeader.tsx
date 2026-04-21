import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
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
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({
  name, personId, isOnline, isClockedIn,
  elapsedSeconds, lastUpdated, silentRefreshing,
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const firstName = name ? name.split(' ')[0] : (personId ? `User #${personId}` : 'there');

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      {/* Greeting */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.name} numberOfLines={1}>{firstName} 👋</Text>
        </View>
        {/* Online/offline dot */}
        <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]}>
          <View style={[styles.dotInner, isOnline ? styles.dotInnerOn : styles.dotInnerOff]} />
          <Text style={styles.dotLabel}>{isOnline ? 'Live' : 'Offline'}</Text>
        </View>
      </Animated.View>

      {/* Clock badge */}
      {isClockedIn && (
        <Animated.View entering={FadeIn.delay(100).duration(350)} style={styles.clockBadge}>
          <Ionicons name="time" size={14} color={colors.success} style={{ marginRight: 6 }} />
          <Text style={styles.clockLabel}>On clock · </Text>
          <Text style={styles.clockTimer}>{fmtHM(elapsedSeconds)}</Text>
          {silentRefreshing && (
            <View style={styles.syncPill}>
              <Ionicons name="sync" size={11} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </Animated.View>
      )}

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={13} color={colors.warning} />
          <Text style={styles.offlineText}>Offline · showing cached data</Text>
        </View>
      )}

      {lastUpdated && isOnline && (
        <Text style={styles.lastUpdated}>
          Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  greetingText: { flex: 1 },
  greeting: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '400',
    marginBottom: 2,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },

  // online pill
  statusDot: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    marginTop: 4,
  },
  dotOnline:  { backgroundColor: 'rgba(52,199,89,0.20)' },
  dotOffline: { backgroundColor: 'rgba(255,149,0,0.20)' },
  dotInner: { width: 7, height: 7, borderRadius: 3.5 },
  dotInnerOn:  { backgroundColor: colors.success },
  dotInnerOff: { backgroundColor: colors.warning },
  dotLabel: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // on-clock timer badge
  clockBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52,199,89,0.18)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 6,
  },
  clockLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  clockTimer: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  syncPill: {
    marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, padding: 3,
  },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,149,0,0.18)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  offlineText: { fontSize: 12, color: 'rgba(255,255,255,0.90)', fontWeight: '500' },
  lastUpdated: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
});
