import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import * as Haptics from 'expo-haptics';
import { PinPad } from '@/components/ui/PinPad';
import { kioskService } from '@/services/kiosk.service';
import { useSessionStore } from '@/store/sessionStore';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';

const KIOSK_TIMEOUT_MS = 30_000; // auto-return to home if idle for 30 s

export default function PinScreen() {
  const router = useRouter();
  const employee = useSessionStore((s) => s.employee);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle timeout — if user taps nothing for 30 s, go back home
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      router.replace('/(kiosk)');
    }, KIOSK_TIMEOUT_MS);
  }, [router]);

  useEffect(() => {
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimeout]);

  // No employee in session means the user navigated here directly — bounce back
  useEffect(() => {
    if (!employee) router.replace('/(kiosk)');
  }, [employee, router]);

  const handlePinChange = useCallback(
    (next: string) => {
      setError(false);
      setErrorMsg('');
      setPin(next);
      resetTimeout();
    },
    [resetTimeout]
  );

  const handleSubmit = useCallback(
    async (submittedPin: string) => {
      if (!employee || loading) return;
      setLoading(true);
      setError(false);
      setErrorMsg('');
      try {
        const verified = await kioskService.verifyPin(employee.personId, submittedPin);
        if (verified) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.push('/(kiosk)/clock');
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(true);
          setErrorMsg('Incorrect PIN. Please try again.');
          setPin('');
          resetTimeout();
        }
      } catch {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setErrorMsg('Verification failed. Check your connection.');
        setPin('');
      } finally {
        setLoading(false);
      }
    },
    [employee, loading, router, resetTimeout]
  );

  if (!employee) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Employee info */}
        <View style={styles.profileCard}>
          {employee.photoUrl ? (
            <Image
              source={{ uri: employee.photoUrl }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {employee.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{employee.name}</Text>
          <Text style={styles.instruction}>Enter your PIN</Text>
        </View>

        {/* PIN pad */}
        <View style={styles.padWrapper}>
          <PinPad
            value={pin}
            maxLength={4}
            onChange={handlePinChange}
            onSubmit={handleSubmit}
            error={error}
          />

          {loading && <ActivityIndicator style={styles.loader} color={colors.primary} />}
          {errorMsg !== '' && <Text style={styles.errorMsg}>{errorMsg}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.replace('/(kiosk)')}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxl,
    padding: spacing.xxl,
  },
  profileCard: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    minWidth: 260,
    ...shadow.card,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
  },
  avatarFallback: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { ...typography.h1, color: colors.textOnPrimary },
  name: { ...typography.h3, color: colors.text, textAlign: 'center' },
  instruction: { ...typography.body, color: colors.textSecondary },
  padWrapper: { alignItems: 'center', gap: spacing.md },
  loader: { marginTop: spacing.sm },
  errorMsg: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  cancelBtn: { marginTop: spacing.md },
  cancelText: { ...typography.label, color: colors.textMuted },
});
