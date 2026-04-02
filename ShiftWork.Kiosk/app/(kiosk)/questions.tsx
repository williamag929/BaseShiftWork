import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import * as Haptics from 'expo-haptics';
import { kioskService } from '@/services/kiosk.service';
import { useSessionStore } from '@/store/sessionStore';
import { useDeviceStore } from '@/store/deviceStore';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import type { KioskAnswer, KioskQuestion } from '@/types';

export default function QuestionsScreen() {
  const router = useRouter();
  const employee = useSessionStore((s) => s.employee);
  const clockType = useSessionStore((s) => s.clockType);
  const capturedPhotoUri = useSessionStore((s) => s.capturedPhotoUri);
  const geoLocation = useSessionStore((s) => s.geoLocation);
  const { companyId, locationId, kioskDeviceId } = useDeviceStore();

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['kiosk-questions', companyId],
    queryFn: () => kioskService.getQuestions(companyId),
    staleTime: 5 * 60_000,
  });

  const handleAnswer = useCallback((questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!employee || !clockType) return;

    // Validate required questions
    const missing = questions
      .filter((q) => q.isRequired && !answers[q.questionId]?.trim())
      .map((q) => q.questionText);

    if (missing.length > 0) {
      setError(`Please answer: ${missing[0]}`);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const answerList: KioskAnswer[] = questions
        .filter((q) => answers[q.questionId]?.trim())
        .map((q) => ({
          kioskQuestionId: q.questionId,
          answerText: answers[q.questionId],
        }));

      await kioskService.clock(companyId, {
        personId: employee.personId,
        eventType: clockType,
        locationId: locationId || undefined,
        photoUrl: capturedPhotoUri ?? undefined,
        geoLocation: geoLocation ?? undefined,
        kioskDevice: kioskDeviceId,
        answers: answerList,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(kiosk)/success');
    } catch {
      setError('Submission failed. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [employee, clockType, questions, answers, companyId, locationId, capturedPhotoUri, geoLocation, kioskDeviceId, router]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>A few quick questions</Text>

        {questions.map((q, i) => (
          <View
            key={q.questionId}
            style={styles.questionCard}
          >
            <Text style={styles.questionText}>
              {q.questionText}
              {q.isRequired && <Text style={styles.required}> *</Text>}
            </Text>

            {q.questionType === 'yes_no' && (
              <View style={styles.yesNoRow}>
                {['Yes', 'No'].map((opt) => (
                  <Pressable
                    key={opt}
                    style={({ pressed }) => [
                      styles.yesNoBtn,
                      answers[q.questionId] === opt && styles.yesNoBtnSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleAnswer(q.questionId, opt)}
                  >
                    <Text
                      style={[
                        styles.yesNoText,
                        answers[q.questionId] === opt && styles.yesNoTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {q.questionType === 'multiple_choice' && (
              <View style={styles.choicesCol}>
                {(q.options ?? []).map((opt) => (
                  <Pressable
                    key={opt}
                    style={({ pressed }) => [
                      styles.choiceRow,
                      answers[q.questionId] === opt && styles.choiceRowSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleAnswer(q.questionId, opt)}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        answers[q.questionId] === opt && styles.choiceTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {q.questionType === 'text' && (
              <TextInput
                style={styles.textInput}
                placeholder="Your answer…"
                placeholderTextColor={colors.textMuted}
                value={answers[q.questionId] ?? ''}
                onChangeText={(v) => handleAnswer(q.questionId, v)}
                multiline
                numberOfLines={3}
              />
            )}
          </View>
        ))}

        {error !== '' && <Text style={styles.errorMsg}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit & Clock {clockType === 'ClockIn' ? 'In' : 'Out'}</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancelLink} onPress={() => router.replace('/(kiosk)')}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.xxl, gap: spacing.xl, maxWidth: 720, alignSelf: 'center', width: '100%' },
  heading: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  questionText: { ...typography.title, color: colors.text },
  required: { color: colors.danger },
  yesNoRow: { flexDirection: 'row', gap: spacing.md },
  yesNoBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  yesNoBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  yesNoText: { ...typography.title, color: colors.textSecondary },
  yesNoTextSelected: { color: '#fff' },
  choicesCol: { gap: spacing.sm },
  choiceRow: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  choiceRowSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '33' },
  choiceText: { ...typography.body, color: colors.textSecondary },
  choiceTextSelected: { color: colors.primary },
  textInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    color: colors.text,
    ...typography.body,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  errorMsg: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitText: { ...typography.title, color: '#fff' },
  cancelLink: { alignSelf: 'center', marginTop: spacing.sm },
  cancelText: { ...typography.label, color: colors.textMuted },
});
