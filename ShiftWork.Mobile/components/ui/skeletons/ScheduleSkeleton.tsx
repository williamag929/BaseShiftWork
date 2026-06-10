import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, spacing } from '@/styles/tokens';

export function ScheduleSkeleton() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Week navigation */}
      <View style={styles.navRow}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width="50%" height={18} borderRadius={6} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      {/* Day columns */}
      <View style={styles.row}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.dayCol}>
            <Skeleton width={28} height={10} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width={28} height={28} borderRadius={14} />
          </View>
        ))}
      </View>
      {/* Shift cards */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.shiftCard}>
          <View style={styles.shiftLeft}>
            <Skeleton width="60%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={56} height={24} borderRadius={12} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  dayCol: { alignItems: 'center' },
  shiftCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, elevation: 1 },
  shiftLeft: { flex: 1 },
});
