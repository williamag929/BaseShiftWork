import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatScheduleTime } from '@/utils/date.utils';
import { colors, radius, spacing } from '@/styles/tokens';
import type { KioskQuestionDto, ScheduleShiftDto } from '@/types/api';

interface SafetyQuestionnaireProps {
  shift: ScheduleShiftDto;
  questions: KioskQuestionDto[];
  locationName: string | null;
}

export function SafetyQuestionnaire({ shift, questions, locationName }: SafetyQuestionnaireProps) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
        </View>
        <View>
          <Text style={styles.title}>Safety Check</Text>
          <Text style={styles.subtitle}>Review before starting your shift</Text>
        </View>
      </View>

      {/* Shift row */}
      <View style={[styles.row, { marginBottom: 3 }]}>
        <Ionicons name="time-outline" size={14} color={colors.primary} />
        <Text style={styles.meta}>
          {formatScheduleTime(shift.startDate)} – {formatScheduleTime(shift.endDate)}
        </Text>
      </View>
      {!!locationName && (
        <View style={styles.row}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={styles.meta}>{locationName}</Text>
        </View>
      )}

      {/* Checklist */}
      {questions.length > 0 && (
        <View style={styles.checklist}>
          {questions.map((q) => (
            <View key={q.questionId} style={styles.itemRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.itemText}>{q.questionText}</Text>
            </View>
          ))}
        </View>
      )}
      {questions.length === 0 && (
        <View style={styles.allClear}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.allClearText}>All clear — you're good to go!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginTop: 16,
    borderRadius: radius.xl, padding: 16,
    borderLeftWidth: 3, borderLeftColor: colors.warning,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,149,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  checklist: { marginTop: 12, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  allClearText: { fontSize: 13, color: colors.success, fontWeight: '500' },
});
