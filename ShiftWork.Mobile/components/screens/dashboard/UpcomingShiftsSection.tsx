import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, SectionHeader } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatTime } from '@/utils/date.utils';
import { colors, spacing } from '@/styles/tokens';
import type { ScheduleShiftDto } from '@/types/api';

interface UpcomingShiftsSectionProps {
  loading: boolean;
  upcoming: ScheduleShiftDto[];
  onViewWeekly: () => void;
}

export function UpcomingShiftsSection({ loading, upcoming, onViewWeekly }: UpcomingShiftsSectionProps) {
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
          <Animated.View key={s.scheduleShiftId} entering={FadeInDown.delay(i * 60).duration(300)}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{formatDate(s.startDate)}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(s.startDate)} - {formatTime(s.endDate)}</Text>
            <Text style={styles.cardLocation}>Shift #{s.scheduleShiftId}</Text>
          </Card>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.lg, paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: 12, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  cardLocation: { fontSize: 14, color: colors.primary },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
  emptyText: { color: colors.muted, fontSize: 13 },
});
