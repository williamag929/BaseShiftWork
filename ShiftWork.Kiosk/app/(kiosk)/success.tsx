import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { outbox } from '@/services/outbox';
import { undoRemainingMs } from '@/services/outbox.service';
import { forgetRecentPunch } from '@/services/punch.service';
import { shouldShowInterstitial } from '@/services/punchFlow';
import { useSessionStore } from '@/store/sessionStore';
import { colors, spacing, radius, typography } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

const MIN_SHOW_MS = 1500; // the confirmation is always visible at least this long

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

  // Visible Undo window = what is left of this punch's hold, fixed when the screen opens.
  const [remainingMs] = useState(() =>
    undoRemainingMs(
      outbox.getSnapshot().entries.find((e) => e.eventLogId === eventLogId),
      Date.now()
    )
  );
  const [canUndo, setCanUndo] = useState(remainingMs > 0);
  const undoingRef = useRef(false);
  const moveOnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoneHomeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideUndoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    for (const ref of [moveOnRef, undoneHomeRef, hideUndoRef]) {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  // A timer made for one punch must never reset/navigate for a later one.
  const isCurrent = useCallback(
    (id: string | null) => useSessionStore.getState().eventLogId === id,
    []
  );

  const goHome = useCallback(() => {
    resetSession();
    router.dismissTo('/(kiosk)');
  }, [resetSession, router]);

  useEffect(() => {
    Haptics.notificationAsync(
      commitError ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
    );
    Animated.sequence([
      Animated.delay(100),
      Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leave this screen: bulletins after an online clock-out, otherwise home.
  const moveOn = useCallback(
    (createdFor: string | null) => {
      if (!isCurrent(createdFor)) return;
      const entries = outbox.getSnapshot().entries;
      if (employee && shouldShowInterstitial(clockType, entries)) {
        router.replace(`/(kiosk)/interstitial?personId=${employee.personId}` as any);
      } else {
        goHome();
      }
    },
    [isCurrent, employee, clockType, router, goHome]
  );

  // When the undo window closes, move on.
  useEffect(() => {
    if (commitError) return undefined;
    const createdFor = eventLogId;
    moveOnRef.current = setTimeout(() => {
      moveOnRef.current = null;
      moveOn(createdFor);
    }, Math.max(remainingMs, MIN_SHOW_MS));
    hideUndoRef.current = setTimeout(() => setCanUndo(false), remainingMs);
    return () => {
      if (moveOnRef.current) clearTimeout(moveOnRef.current);
      if (hideUndoRef.current) clearTimeout(hideUndoRef.current);
    };
  // Runs once per screen: the window is fixed at mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUndo = useCallback(async () => {
    if (!eventLogId || !employee || undoingRef.current) return;
    // Synchronous guard + hide the button before any await: a second tap is ignored.
    undoingRef.current = true;
    setCanUndo(false);
    // Stop the move-on timer first so it cannot fire while undo() is awaited.
    if (moveOnRef.current) clearTimeout(moveOnRef.current);
    moveOnRef.current = null;
    const removed = await outbox.undo(eventLogId);
    // Whenever the punch was removed the employee must be able to punch again, even if
    // this screen has since moved on.
    if (removed) forgetRecentPunch(employee.personId);
    if (!isCurrent(eventLogId)) return;
    if (!removed) {
      // Window already closed: carry on exactly as the timer would have.
      moveOn(eventLogId);
      return;
    }
    setUndone(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    undoneHomeRef.current = setTimeout(() => {
      undoneHomeRef.current = null;
      if (isCurrent(eventLogId)) goHome();
    }, 1200);
  }, [eventLogId, employee, goHome, isCurrent, moveOn]);

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
            {canUndo && (
            <Pressable
              style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.7 }]}
              onPress={handleUndo}
              accessibilityRole="button"
            >
              <Text style={styles.undoText}>{t('kiosk_app.undo')}</Text>
            </Pressable>
            )}
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
