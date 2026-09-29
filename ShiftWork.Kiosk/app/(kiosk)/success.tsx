import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { outbox } from '@/services/outbox';
import { UNDO_HOLD_MS } from '@/services/outbox.service';
import { forgetRecentPunch } from '@/services/punch.service';
import { shouldShowInterstitial } from '@/services/punchFlow';
import { useSessionStore } from '@/store/sessionStore';
import { colors, spacing, radius, typography } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

/**
 * Shown right after a punch is recorded on this tablet (sending happens in the background).
 * For the 3-second undo window the employee can cancel it; then the kiosk moves on:
 * to the bulletins/safety screen after an online clock-out, otherwise straight home.
 */
export default function SuccessScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const employee = useSessionStore((s) => s.employee);
  const clockType = useSessionStore((s) => s.clockType);
  const eventLogId = useSessionStore((s) => s.eventLogId);
  const commitError = useSessionStore((s) => s.commitError);
  const resetSession = useSessionStore((s) => s.reset);

  const [undone, setUndone] = useState(false);
  const [eventTime] = useState(() =>
    new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  );
  const scale = useRef(new Animated.Value(0)).current;

  const goHome = useCallback(() => {
    resetSession();
    router.replace('/(kiosk)');
  }, [resetSession, router]);

  useEffect(() => {
    Haptics.notificationAsync(
      commitError ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
    );
    Animated.sequence([
      Animated.delay(100),
      Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the undo window closes, move on.
  useEffect(() => {
    if (commitError || undone) return undefined;
    const id = setTimeout(() => {
      const entries = outbox.getSnapshot().entries;
      if (employee && shouldShowInterstitial(clockType, entries)) {
        router.replace(`/(kiosk)/interstitial?personId=${employee.personId}` as any);
      } else {
        goHome();
      }
    }, UNDO_HOLD_MS);
    return () => clearTimeout(id);
  }, [commitError, undone, clockType, employee, router, goHome]);

  const handleUndo = useCallback(async () => {
    if (!eventLogId || !employee) return;
    const removed = await outbox.undo(eventLogId);
    if (!removed) return; // window already closed
    forgetRecentPunch(employee.personId);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setUndone(true);
    setTimeout(goHome, 1200);
  }, [eventLogId, employee, goHome]);

  if (commitError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={112} color={colors.danger} />
          <Text style={styles.errTitle}>{t('kiosk_app.commit_error_title')}</Text>
          <Text style={styles.errBody}>{t('kiosk_app.commit_error_body')}</Text>
          <Pressable style={styles.okBtn} onPress={goHome}>
            <Text style={styles.okText}>{t('kiosk_app.commit_error_ok')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const label = clockType === 'ClockIn' ? t('kiosk_app.clocked_in') : t('kiosk_app.clocked_out');
  const bgColor = clockType === 'ClockIn' ? colors.clockIn : colors.clockOut;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale }] }]}>
          <Ionicons name={undone ? 'close-circle' : 'checkmark-circle'} size={128} color="#fff" />
        </Animated.View>

        <Text style={styles.name}>{employee?.name ?? t('kiosk_app.employee_fallback')}</Text>
        {undone ? (
          <Text style={styles.label}>{t('kiosk_app.punch_cancelled')}</Text>
        ) : (
          <>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.time}>{eventTime}</Text>
            <Pressable
              style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.7 }]}
              onPress={handleUndo}
              accessibilityRole="button"
            >
              <Text style={styles.undoText}>{t('kiosk_app.undo')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  iconWrapper: { marginBottom: spacing.sm },
  name: { fontSize: 34, fontWeight: '700' as const, color: '#fff', textAlign: 'center', letterSpacing: 0.37 },
  label: { fontSize: 22, fontWeight: '300' as const, color: 'rgba(255,255,255,0.8)', letterSpacing: -0.2 },
  time: { fontSize: 48, fontWeight: '200' as const, color: 'rgba(255,255,255,0.9)', letterSpacing: -2, marginTop: spacing.sm },
  undoBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  undoText: { ...typography.title, color: '#fff' },
  errTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  errBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 420 },
  okBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  okText: { ...typography.title, color: colors.textOnPrimary },
});
