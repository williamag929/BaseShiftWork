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
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { kioskService } from '@/services/kiosk.service';
import { useDeviceStore } from '@/store/deviceStore';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import type { KioskLocation } from '@/types';

type AdminStep = 'password' | 'menu' | 'changeLocation';

export default function AdminScreen() {
  const router = useRouter();
  const { companyId, locationName, kioskDeviceId, enroll, resetDevice } = useDeviceStore();

  const [step, setStep] = useState<AdminStep>('password');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<KioskLocation | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['kiosk-locations', companyId],
    queryFn: () => kioskService.getLocations(companyId),
    enabled: step === 'changeLocation',
  });

  const handleVerifyPassword = useCallback(async () => {
    if (!password.trim()) return;
    setVerifying(true);
    setAuthError('');
    try {
      // Admin password verification — backend returns 200 on match, 401 on mismatch.
      // The endpoint exists but requires Authorize(Policy="kiosk.admin") on the server.
      // For the standalone kiosk app the server should be updated to [AllowAnonymous]
      // on this endpoint. Until then, a 401 from the API is caught as an error below.
      await kioskService.verifyAdminPassword(companyId, password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('menu');
    } catch {
      setAuthError('Incorrect password.');
      setPassword('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setVerifying(false);
    }
  }, [password, companyId]);

  const handleChangeLocation = useCallback(async () => {
    if (!selectedLocation) return;
    setSaving(true);
    try {
      await enroll({
        companyId,
        locationId: selectedLocation.locationId,
        locationName: selectedLocation.name,
        kioskDeviceId,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(kiosk)');
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [selectedLocation, companyId, enroll, router]);

  const handleResetDevice = useCallback(async () => {
    await resetDevice();
    router.replace('/(setup)');
  }, [resetDevice, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Admin Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Password gate ── */}
        {step === 'password' && (
          <Animated.View style={styles.card} entering={FadeInDown.duration(250)}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.primary} />
            <Text style={styles.cardTitle}>Enter Admin Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Admin password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
              onSubmitEditing={handleVerifyPassword}
              returnKeyType="done"
            />
            {authError !== '' && <Text style={styles.error}>{authError}</Text>}
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleVerifyPassword}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify</Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* ── Step 2: Admin menu ── */}
        {step === 'menu' && (
          <Animated.View style={styles.menuContainer} entering={FadeInDown.duration(250)}>
            <Text style={styles.cardTitle}>What would you like to do?</Text>
            <Text style={styles.subtitle}>Current location: {locationName}</Text>

            <Pressable
              style={({ pressed }) => [styles.menuCard, pressed && { opacity: 0.85 }]}
              onPress={() => setStep('changeLocation')}
            >
              <Ionicons name="location-outline" size={32} color={colors.primary} />
              <View style={styles.menuCardText}>
                <Text style={styles.menuCardTitle}>Change Location</Text>
                <Text style={styles.menuCardSub}>Assign this device to a different location</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuCard, styles.dangerCard, pressed && { opacity: 0.85 }]}
              onPress={handleResetDevice}
            >
              <Ionicons name="trash-outline" size={32} color={colors.danger} />
              <View style={styles.menuCardText}>
                <Text style={[styles.menuCardTitle, { color: colors.danger }]}>Reset Device</Text>
                <Text style={styles.menuCardSub}>Remove enrollment — re-setup required</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Step 3: Change Location ── */}
        {step === 'changeLocation' && (
          <Animated.View style={styles.menuContainer} entering={FadeInDown.duration(250)}>
            <Pressable style={styles.backLink} onPress={() => setStep('menu')}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.cardTitle}>Select Location</Text>

            {locationsLoading ? (
              <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.xl }} />
            ) : (
              <>
                {locations.map((loc) => (
                  <Pressable
                    key={loc.locationId}
                    style={({ pressed }) => [
                      styles.locationRow,
                      selectedLocation?.locationId === loc.locationId && styles.locationRowSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedLocation(loc)}
                  >
                    <Text
                      style={[
                        styles.locationText,
                        selectedLocation?.locationId === loc.locationId && styles.locationTextSelected,
                      ]}
                    >
                      {loc.name}
                    </Text>
                    {selectedLocation?.locationId === loc.locationId && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                ))}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { marginTop: spacing.lg },
                    (!selectedLocation || saving) && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleChangeLocation}
                  disabled={!selectedLocation || saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save Location</Text>
                  )}
                </Pressable>
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  closeBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.text },
  content: {
    padding: spacing.xxl,
    gap: spacing.xl,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
    ...shadow.card,
  },
  cardTitle: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary },
  input: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  error: { ...typography.caption, color: colors.danger },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { ...typography.title, color: '#fff' },
  menuContainer: { gap: spacing.md },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  dangerCard: { borderWidth: 1, borderColor: colors.danger + '44' },
  menuCardText: { flex: 1 },
  menuCardTitle: { ...typography.title, color: colors.text },
  menuCardSub: { ...typography.caption, color: colors.textSecondary },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  backText: { ...typography.label, color: colors.primary },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  locationRowSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '1A' },
  locationText: { ...typography.body, color: colors.textSecondary },
  locationTextSelected: { color: colors.primary },
});
