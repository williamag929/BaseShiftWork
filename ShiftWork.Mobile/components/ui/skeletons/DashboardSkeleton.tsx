import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, spacing } from '@/styles/tokens';

function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <View style={[styles.card, { minHeight: height }]}>
      <Skeleton width="40%" height={14} borderRadius={6} style={{ marginBottom: 10 }} />
      <Skeleton width="70%" height={20} borderRadius={6} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width="50%" height={22} borderRadius={6} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>
      {/* Status card */}
      <View style={[styles.card, { padding: spacing.lg }]}>
        <Skeleton width="30%" height={14} borderRadius={6} style={{ marginBottom: 12 }} />
        <Skeleton width="60%" height={32} borderRadius={8} />
      </View>
      {/* Stats row */}
      <View style={styles.row}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.card, styles.statCard]}>
            <Skeleton width="80%" height={28} borderRadius={6} style={{ marginBottom: 8 }} />
            <Skeleton width="60%" height={11} borderRadius={4} />
          </View>
        ))}
      </View>
      {/* Upcoming shifts */}
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1 },
});
