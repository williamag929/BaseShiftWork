import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, spacing } from '@/styles/tokens';

export function ClockSkeleton() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Status banner */}
      <View style={styles.banner}>
        <Skeleton width="40%" height={14} borderRadius={6} style={{ marginBottom: 10 }} />
        <Skeleton width="60%" height={20} borderRadius={6} />
      </View>
      {/* Clock circle */}
      <View style={styles.centered}>
        <Skeleton width={160} height={160} borderRadius={80} />
      </View>
      {/* Timer */}
      <View style={styles.centered}>
        <Skeleton width={120} height={28} borderRadius={8} style={{ marginTop: 20 }} />
      </View>
      {/* Step indicators */}
      <View style={styles.steps}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.stepItem}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <Skeleton width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      {/* History */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.historyRow}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Skeleton width="50%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="30%" height={11} borderRadius={4} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  banner: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, elevation: 1 },
  centered: { alignItems: 'center' },
  steps: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.lg },
  stepItem: { alignItems: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, elevation: 1 },
});
