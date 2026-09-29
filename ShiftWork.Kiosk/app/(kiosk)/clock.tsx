import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { useSessionStore } from '@/store/sessionStore';
import { usePunchNavigator } from '@/hooks/usePunchNavigator';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

const TIMEOUT_MS = 60_000;
const COUNTDOWN_SECONDS = 1;

/**
 * Photo step. Only opened when the site requires a photo and the employee is not exempt
 * (see nextStep). Takes the picture by itself after a short countdown; a manual button
 * appears only if that fails.
 */
export default function PhotoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const employee = useSessionStore((s) => s.employee);
  const clockType = useSessionStore((s) => s.clockType);
  const setCapturedPhoto = useSessionStore((s) => s.setCapturedPhoto);
  const resetSession = useSessionStore((s) => s.reset);
  const goNext = usePunchNavigator();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [capturing, setCapturing] = useState(false);
  const [failed, setFailed] = useState(false);
  // Once a photo is taken this screen must never capture again (a late re-render must not retrigger it).
  const [captured, setCaptured] = useState(false);
  const busyRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle timeout: back to the employee list if nothing happens.
  const armIdle = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      resetSession();
      router.dismissTo('/(kiosk)');
    }, TIMEOUT_MS);
  }, [router, resetSession]);

  useEffect(() => {
    armIdle();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [armIdle]);

  const cancel = useCallback(() => {
    resetSession();
    router.dismissTo('/(kiosk)');
  }, [resetSession, router]);

  useEffect(() => {
    if (!employee) router.dismissTo('/(kiosk)');
  }, [employee, router]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || busyRef.current) return;
    busyRef.current = true;
    // Capture -> commit must not be interrupted by the idle timer (re-armed if it fails).
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCapturing(true);
    setFailed(false);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo) throw new Error('No photo captured');
      setCapturedPhoto(photo.uri);
      setCaptured(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await goNext('photo');
    } catch {
      armIdle();
      setFailed(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      busyRef.current = false;
      setCapturing(false);
    }
  }, [setCapturedPhoto, goNext, armIdle]);

  // Count down once the camera is live, then capture.
  useEffect(() => {
    if (!cameraReady || failed || capturing || captured) return undefined;
    if (count <= 0) {
      void capture();
      return undefined;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cameraReady, failed, capturing, captured, count, capture]);

  if (!employee) return null;

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>
          {permission.canAskAgain
            ? t('kiosk_app.camera_required')
            : t('kiosk_app.camera_blocked')}
        </Text>
        {permission.canAskAgain && (
          <Pressable style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>{t('kiosk_app.grant_camera')}</Text>
          </Pressable>
        )}
        <Pressable onPress={cancel}>
          <Text style={styles.cancel}>{t('kiosk_app.cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  const action = clockType === 'ClockOut' ? t('kiosk_app.clock_out') : t('kiosk_app.clock_in');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setFailed(true)}
        />
        <View style={styles.viewfinder} pointerEvents="none" />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraLabel}>
            {t('kiosk_app.look_at_camera', { action })}
          </Text>
          {failed ? (
            <Pressable
              style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.8 }]}
              onPress={capture}
              disabled={capturing}
            >
              <Ionicons name="camera" size={40} color="#fff" />
            </Pressable>
          ) : (
            <Text style={styles.countdown}>
              {capturing || count <= 0
                ? t('kiosk_app.recording')
                : t('kiosk_app.photo_countdown', { count })}
            </Text>
          )}
          {failed && <Text style={styles.cancel}>{t('kiosk_app.photo_retry')}</Text>}
          <Pressable onPress={cancel}>
            <Text style={styles.cancel}>{t('kiosk_app.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xxl },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  viewfinder: {
    position: 'absolute',
    top: '10%',
    bottom: '28%',
    left: '20%',
    right: '20%',
    borderRadius: 9999,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: spacing.xl,
  },
  cameraLabel: { ...typography.title, color: '#fff' },
  countdown: { ...typography.h3, color: '#fff' },
  captureBtn: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    ...shadow.raised,
  },
  permText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  btnText: { ...typography.title, color: colors.textOnPrimary },
  cancel: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm },
});
