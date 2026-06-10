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
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '@/store/sessionStore';
import { useDeviceStore } from '@/store/deviceStore';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import { kioskService } from '@/services/kiosk.service';
import { Ionicons } from '@expo/vector-icons';
import type { ClockEventType } from '@/types';

const TIMEOUT_MS = 60_000;

export default function ClockScreen() {
  const router = useRouter();
  const employee = useSessionStore((s) => s.employee);
  const setCapturedPhoto = useSessionStore((s) => s.setCapturedPhoto);
  const setClockType = useSessionStore((s) => s.setClockType);
  const setGeoLocation = useSessionStore((s) => s.setGeoLocation);
  const setNeedsClockSubmit = useSessionStore((s) => s.setNeedsClockSubmit);
  const { companyId, locationId, kioskDeviceId } = useDeviceStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [clockChoice, setClockChoice] = useState<ClockEventType | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch kiosk questions to decide if we need the questions screen
  const { data: questions = [] } = useQuery({
    queryKey: ['kiosk-questions', companyId],
    queryFn: () => kioskService.getQuestions(companyId),
    staleTime: 5 * 60_000,
  });

  const resetIdle = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => router.replace('/(kiosk)'), TIMEOUT_MS);
  }, [router]);

  useEffect(() => {
    resetIdle();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [resetIdle]);

  useEffect(() => {
    if (!employee) router.replace('/(kiosk)');
  }, [employee, router]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || !clockChoice) return;
    setCapturing(true);
    resetIdle();

    try {
      // Get location for geo tagging
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setGeoLocation(`${loc.coords.latitude},${loc.coords.longitude}`);
        }
      } catch {
        // geo is optional — do not block on failure
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: Platform.OS === 'android',
      });

      if (!photo) throw new Error('No photo captured');
      setCapturedPhoto(photo.uri);
      setClockType(clockChoice);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (questions.length > 0) {
        setNeedsClockSubmit(false);
        router.push('/(kiosk)/questions');
      } else {
        setNeedsClockSubmit(true);
        router.push('/(kiosk)/success');
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCapturing(false);
    }
  }, [capturing, clockChoice, setCapturedPhoto, setClockType, setGeoLocation, setNeedsClockSubmit, questions, router, resetIdle]);

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
        <Text style={styles.permText}>Camera access is required to clock in.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Camera Access</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(kiosk)')}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* Clock-type selector */}
        {!clockChoice ? (
          <View style={styles.choiceRow}>
            <Text style={styles.choiceLabel}>
              Hello, {employee.name}.\nWhat would you like to do?
            </Text>
            <View style={styles.buttons}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.clockInBtn, pressed && { opacity: 0.88 }]}
                onPress={() => { setClockChoice('ClockIn'); resetIdle(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              >
                <Ionicons name="log-in-outline" size={40} color="#fff" />
                <Text style={styles.actionText}>Clock In</Text>
                <Text style={styles.actionSubText}>Start your shift</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.clockOutBtn, pressed && { opacity: 0.88 }]}
                onPress={() => { setClockChoice('ClockOut'); resetIdle(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              >
                <Ionicons name="log-out-outline" size={40} color="#fff" />
                <Text style={styles.actionText}>Clock Out</Text>
                <Text style={styles.actionSubText}>End your shift</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.replace('/(kiosk)')}>
              <Text style={styles.cancel}>← Back</Text>
            </Pressable>
          </View>
        ) : (
          /* Camera preview */
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            />
            {/* Viewfinder oval guide */}
            <View style={styles.viewfinder} pointerEvents="none" />
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraLabel}>
                {clockChoice === 'ClockIn' ? 'Clock In' : 'Clock Out'} — look at the camera
              </Text>
              <Pressable
                style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.8 }]}
                onPress={handleCapture}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <Ionicons name="camera" size={40} color="#fff" />
                )}
              </Pressable>
              <Pressable onPress={() => { setClockChoice(null); resetIdle(); }}>
                <Text style={styles.cancel}>← Change</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xxl },
  container: { flex: 1 },
  choiceRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxxl,
    padding: spacing.xxl,
  },
  choiceLabel: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 38,
  },
  buttons: { flexDirection: 'row', gap: spacing.xl },
  actionBtn: {
    width: 220,
    height: 190,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.raised,
  },
  clockInBtn: { backgroundColor: colors.clockIn },
  clockOutBtn: { backgroundColor: colors.clockOut },
  actionText: { ...typography.h3, color: '#fff' },
  actionSubText: { ...typography.caption, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 },
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
