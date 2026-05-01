import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatScheduleTime } from '@/utils/date.utils';
import { colors, radius, spacing } from '@/styles/tokens';
import type { KioskQuestionDto, ScheduleShiftDto } from '@/types/api';

export type QuestionAnswers = Record<number, string>;

interface SafetyQuestionnaireProps {
  shift: ScheduleShiftDto;
  questions: KioskQuestionDto[];
  locationName: string | null;
  answers: QuestionAnswers;
  onAnswersChange: (answers: QuestionAnswers) => void;
}

export function SafetyQuestionnaire({
  shift,
  questions,
  locationName,
  answers,
  onAnswersChange,
}: SafetyQuestionnaireProps) {
  const setAnswer = (questionId: number, value: string) => {
    onAnswersChange({ ...answers, [questionId]: value });
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
        </View>
        <View>
          <Text style={styles.title}>Safety Check</Text>
          <Text style={styles.subtitle}>Answer before starting your shift</Text>
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

      {/* Interactive questions */}
      {questions.length > 0 && (
        <View style={styles.questionsContainer}>
          {questions.map((q, index) => (
            <Animated.View
              key={q.questionId}
              entering={FadeInDown.delay(index * 60).duration(300)}
              style={styles.questionBlock}
            >
              <Text style={styles.questionText}>
                {q.questionText}
                {q.isRequired && <Text style={styles.required}> *</Text>}
              </Text>

              {q.questionType === 'yes_no' && (
                <View style={styles.yesNoRow}>
                  {(['Yes', 'No'] as const).map((option) => {
                    const selected = answers[q.questionId] === option;
                    return (
                      <Pressable
                        key={option}
                        style={[styles.yesNoBtn, selected && styles.yesNoBtnSelected]}
                        onPress={() => setAnswer(q.questionId, option)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.yesNoBtnText, selected && styles.yesNoBtnTextSelected]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {q.questionType === 'multiple_choice' && (
                <View style={styles.optionsList}>
                  {(q.options ?? []).map((option) => {
                    const selected = answers[q.questionId] === option;
                    return (
                      <Pressable
                        key={option}
                        style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                        onPress={() => setAnswer(q.questionId, option)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <View style={[styles.optionDot, selected && styles.optionDotSelected]} />
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {q.questionType === 'text' && (
                <TextInput
                  style={styles.textInput}
                  value={answers[q.questionId] ?? ''}
                  onChangeText={(val) => setAnswer(q.questionId, val)}
                  placeholder="Type your answer…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={2}
                />
              )}
            </Animated.View>
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

  questionsContainer: { marginTop: 16, gap: 16 },
  questionBlock: { gap: 8 },
  questionText: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  required: { color: colors.danger },

  // Yes / No
  yesNoRow: { flexDirection: 'row', gap: 8 },
  yesNoBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.background,
  },
  yesNoBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  yesNoBtnText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  yesNoBtnTextSelected: { color: colors.primary },

  // Multiple choice
  optionsList: { gap: 6 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  optionDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border,
  },
  optionDotSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { fontSize: 14, color: colors.muted },
  optionTextSelected: { color: colors.text, fontWeight: '500' },

  // Free text
  textInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: colors.text, backgroundColor: colors.background,
    minHeight: 60, textAlignVertical: 'top',
  },

  allClear: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  allClearText: { fontSize: 13, color: colors.success, fontWeight: '500' },
});
