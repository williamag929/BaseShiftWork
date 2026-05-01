import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { kioskService } from '@/services/kiosk.service';
import { useSessionStore } from '@/store/sessionStore';
import { useDeviceStore } from '@/store/deviceStore';
import { colors, spacing, typography } from '@/styles/tokens';

const AUTO_RETURN_SECONDS = 5;

/**
 * Success screen.
 *
 * Two entry paths:
 *  1. From questions.tsx — clock API call already done, arrive with no-questions=true in params
 *  2. From clock.tsx directly (no questions) — this screen makes the clock API call
 *
 * Expo Router local-search-param convention: pass `?noQuestions=1` from clock.tsx when
 * navigating here without questions so this screen knows it must submit.
 */
export default function SuccessScreen() {
  const router = useRouter();
  const employee = useSessionStore((s) => s.employee);
  const clockType = useSessionStore((s) => s.clockType);
  const capturedPhotoUri = useSessionStore((s) => s.capturedPhotoUri);
  const geoLocation = useSessionStore((s) => s.geoLocation);
  const resetSession = useSessionStore((s) => s.reset);
  const { companyId, locationId, kioskDeviceId } = useDeviceStore();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(AUTO_RETURN_SECONDS);
  const [eventTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const scale = useRef(new Animated.Value(0)).current;

  // Determine if the clock call needs to happen here (no-questions path).
  // clock.tsx stores a flag in sessionStore rather than route params to avoid complexity.
  const needsSubmit = useSessionStore((s) => s.needsClockSubmit);

  const submit = useCallback(async () => {
    if (submitting || submitted) return;
    if (!employee || !clockType) {
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    try {
      await kioskService.clock(companyId, {
        personId: employee.personId,
        eventType: clockType,
        locationId: locationId || undefined,
        photoUrl: capturedPhotoUri ?? undefined,
        geoLocation: geoLocation ?? undefined,
        kioskDevice: kioskDeviceId,
        answers: [],
      });
      setSubmitted(true);
    } catch {
      setError('Could not record your clock event. Please notify your manager.');
      setSubmitted(true); // still show success UX — error logged separately
    } finally {
      setSubmitting(false);
    }
  }, [employee, clockType, companyId, locationId, capturedPhotoUri, geoLocation, kioskDeviceId, submitting, submitted]);

  // On mount: play haptic, animate icon, optionally submit
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.delay(100),
      Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    if (needsSubmit) {
      submit();
    } else {
      setSubmitted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After submission: clock-outs go to the interstitial (bulletins/safety);
  // clock-ins just count down and return home.
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!submitted) return;

    if (clockType === 'ClockOut' && employee) {
      // Brief pause so the success checkmark is visible before transitioning
      const t = setTimeout(() => {
        router.replace(`/(kiosk)/interstitial?personId=${employee.personId}` as any);
      }, 1800);
      return () => clearTimeout(t);
    }

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          resetSession();
          router.replace('/(kiosk)');
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [submitted, resetSession, router, clockType, employee]);

  const label = clockType === 'ClockIn' ? 'Clocked In' : 'Clocked Out';
  const bgColor = clockType === 'ClockIn' ? colors.clockIn : colors.clockOut;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]}>
      {submitting && !submitted ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.waitText}>Recording…</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale }] }]}>
            <Ionicons name="checkmark-circle" size={128} color="#fff" />
          </Animated.View>

          <Text style={styles.name}>{employee?.name ?? 'Employee'}</Text>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.time}>{eventTime}</Text>

          {error !== '' && <Text style={styles.errorMsg}>{error}</Text>}

          {submitted && (
            <Text style={styles.countdown}>
              Returning in {countdown}s…
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  iconWrapper: { marginBottom: spacing.sm },
  name: { fontSize: 34, fontWeight: '700' as const, color: '#fff', textAlign: 'center', letterSpacing: 0.37 },
  label: { fontSize: 22, fontWeight: '300' as const, color: 'rgba(255,255,255,0.8)', letterSpacing: -0.2 },
  time: { fontSize: 48, fontWeight: '200' as const, color: 'rgba(255,255,255,0.9)', letterSpacing: -2, marginTop: spacing.sm },
  waitText: { ...typography.body, color: '#fff', marginTop: spacing.md },
  errorMsg: { ...typography.caption, color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 400 },
  countdown: { ...typography.footnote, color: 'rgba(255,255,255,0.5)', marginTop: spacing.xl },
});
