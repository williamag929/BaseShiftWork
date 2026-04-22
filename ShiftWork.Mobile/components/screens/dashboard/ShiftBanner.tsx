import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatScheduleTime } from '@/utils/date.utils';
import { colors, radius } from '@/styles/tokens';
import type { ScheduleShiftDto } from '@/types/api';

interface ShiftBannerProps {
  shift: ScheduleShiftDto;
  isClockedIn: boolean;
  locationName: string | null;
  timeZoneId?: string | null;
  onPress: () => void;
}

export function ShiftBanner({ shift, isClockedIn, locationName, timeZoneId, onPress }: ShiftBannerProps) {
  const isIn = isClockedIn;
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.wrapper}>
      <PressableScale
        style={[styles.banner, isIn ? styles.bannerIn : styles.bannerOut]}
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={isIn ? 'You are on the clock' : 'Tap to clock in'}
      >
        {/* Left icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: isIn ? 'rgba(52,199,89,0.22)' : 'rgba(255,59,48,0.22)' }]}>
          <Ionicons
            name={isIn ? 'checkmark-circle' : 'log-in-outline'}
            size={26}
            color={isIn ? colors.success : colors.danger}
          />
        </View>

        <View style={styles.info}>
          <Text style={styles.title}>
            {isIn ? 'On the clock' : 'Tap to clock in'}
          </Text>
          <Text style={styles.time}>
            {formatScheduleTime(shift.startDate, timeZoneId ?? undefined)} – {formatScheduleTime(shift.endDate, timeZoneId ?? undefined)}
          </Text>
          {!!locationName && (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={12} color={colors.muted} />
              <Text style={styles.loc}>{locationName}</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, marginBottom: 6 },
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  bannerIn:  { borderLeftWidth: 3, borderLeftColor: colors.success },
  bannerOut: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  time:  { fontSize: 13, color: colors.muted },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  loc:   { fontSize: 12, color: colors.muted },
});
