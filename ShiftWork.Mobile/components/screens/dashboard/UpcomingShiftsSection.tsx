import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, SectionHeader } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatDate, formatScheduleTime } from '@/utils/date.utils';
import { colors, spacing, radius } from '@/styles/tokens';
import type { ScheduleShiftDto } from '@/types/api';

interface UpcomingShiftsSectionProps {
  loading: boolean;
  upcoming: ScheduleShiftDto[];
  timeZoneId?: string | null;
  onSelectShift?: (shift: ScheduleShiftDto) => void;
  onViewWeekly: () => void;
}

export function UpcomingShiftsSection({ loading, upcoming, timeZoneId, onSelectShift, onViewWeekly }: UpcomingShiftsSectionProps) {
  const nextShift = upcoming.length ? upcoming[0] : null;
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next Shift</Text>
        {loading && <Skeleton width="100%" height={70} borderRadius={12} />}
        {!loading && !nextShift && (
          <EmptyState
            title="No upcoming shifts"
            message="Check your schedule or ask a manager."
            icon="calendar-outline"
          />
        )}
        {!loading && nextShift && (
          <PressableScale onPress={() => onSelectShift?.(nextShift)} style={styles.nextCard}>
            <View style={styles.nextCardLeft}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{formatDate(nextShift.startDate)}</Text>
              <Text style={styles.cardSubtitle}>
                {formatScheduleTime(nextShift.startDate, timeZoneId ?? undefined)} – {formatScheduleTime(nextShift.endDate, timeZoneId ?? undefined)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </PressableScale>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Upcoming Shifts"
          rightSlot={
            <Pressable onPress={onViewWeekly}>
              <Text style={styles.link}>View Weekly</Text>
            </Pressable>
          }
        />
        {loading && [0,1,2].map((i) => <Skeleton key={i} width="100%" height={70} borderRadius={12} style={{ marginBottom: 12 }} />)}
        {!loading && upcoming.length === 0 && (
          <View style={styles.emptyRow}>
            <Ionicons name="calendar-clear-outline" size={18} color={colors.muted} />
            <Text style={styles.emptyText}>No upcoming shifts</Text>
          </View>
        )}
        {!loading && upcoming.map((s, i) => (
          <Animated.View
            key={`upcoming-${s.scheduleShiftId ?? 'na'}-${s.startDate}-${s.endDate}-${s.locationId ?? 'loc'}-${i}`}
            entering={FadeInDown.delay(i * 60).duration(300)}
          >
            <PressableScale onPress={() => onSelectShift?.(s)} style={styles.card}>
              <View style={styles.cardDateBadge}>
                <Text style={styles.cardDateNum}>{new Date(s.startDate).getDate()}</Text>
                <Text style={styles.cardDateMon}>
                  {new Date(s.startDate).toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{formatDate(s.startDate)}</Text>
                <Text style={styles.cardSubtitle}>
                  {formatScheduleTime(s.startDate, timeZoneId ?? undefined)} – {formatScheduleTime(s.endDate, timeZoneId ?? undefined)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </PressableScale>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 12 },
  // Next shift card
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary + '12', borderRadius: radius.xl,
    padding: 14, marginBottom: 4,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  nextCardLeft: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  // Upcoming list card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardDateBadge: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  cardDateNum: { fontSize: 16, fontWeight: '700', color: colors.primary, lineHeight: 18 },
  cardDateMon: { fontSize: 10, fontWeight: '600', color: colors.primary, opacity: 0.75 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: colors.muted },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  emptyText: { color: colors.muted, fontSize: 13 },
});
