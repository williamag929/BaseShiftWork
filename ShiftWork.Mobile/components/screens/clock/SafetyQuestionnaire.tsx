import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { formatScheduleTime } from '@/utils/date.utils';
import { colors } from '@/styles/tokens';
import type { KioskQuestionDto, ScheduleShiftDto } from '@/types/api';

interface SafetyQuestionnaireProps {
  shift: ScheduleShiftDto;
  questions: KioskQuestionDto[];
  locationName: string | null;
}

export function SafetyQuestionnaire({ shift, questions, locationName }: SafetyQuestionnaireProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={20} color="#E67E22" />
        <Text style={styles.title}>Pre-Task Safety Check</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={15} color={colors.primary} />
        <Text style={styles.shiftText}>
          Today's Shift: {formatScheduleTime(shift.startDate)} — {formatScheduleTime(shift.endDate)}
        </Text>
      </View>
      {!!locationName && (
        <View style={styles.row}>
          <Ionicons name="location-outline" size={15} color={colors.primary} />
          <Text style={styles.shiftText}>{locationName}</Text>
        </View>
      )}
      {questions.length > 0 && (
        <>
          <Text style={styles.subtitle}>Review before starting your shift:</Text>
          {questions.map((q) => (
            <View key={q.questionId} style={styles.itemRow}>
              <Ionicons name="checkbox-outline" size={16} color={colors.success} />
              <Text style={styles.itemText}>{q.questionText}</Text>
            </View>
          ))}
        </>
      )}
      {questions.length === 0 && (
        <Text style={styles.noItems}>No pending safety items. You're good to go!</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#E67E22' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#E67E22' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  shiftText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 10, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  itemText: { flex: 1, fontSize: 13, color: colors.text },
  noItems: { fontSize: 12, color: colors.muted, marginTop: 8, fontStyle: 'italic' },
});
