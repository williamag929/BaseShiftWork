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
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useDeviceStore } from '@/store/deviceStore';
import { kioskService } from '@/services/kiosk.service';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import { logger } from '@/utils/logger';
import type { KioskLocation } from '@/types';

type Step = 'company' | 'location';

export default function SetupScreen() {
  const router = useRouter();
  const enroll = useDeviceStore((s) => s.enroll);

  const [step, setStep] = useState<Step>('company');
  const [companyId, setCompanyId] = useState('');
  const [locations, setLocations] = useState<KioskLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<KioskLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnectCompany = useCallback(async () => {
    if (!companyId.trim()) {
      setError('Please enter a Company ID.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const locs = await kioskService.getLocations(companyId.trim());
      setLocations(locs.filter((l) => l.isActive));
      setStep('location');
    } catch (e) {
      logger.error('[Setup] Failed to fetch locations', e);
      setError('Could not connect. Check the Company ID and network.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const handleActivate = useCallback(async () => {
    if (!selectedLocation) {
      setError('Please select a location.');
      return;
    }
    setLoading(true);
    try {
      const deviceName = Device.deviceName ?? 'Kiosk Device';
      const kioskDeviceId = `kiosk-${Date.now()}`;
      await enroll({
        companyId: companyId.trim(),
        locationId: selectedLocation.locationId,
        locationName: selectedLocation.name,
        kioskDeviceId: `${deviceName}-${kioskDeviceId}`,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(kiosk)');
    } catch (e) {
      logger.error('[Setup] Enrollment failed', e);
      setError('Failed to activate device. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, companyId, enroll, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logoText}>ShiftWork Kiosk</Text>
          <Text style={styles.subtitle}>
            {step === 'company' ? 'Connect this device to your company' : 'Select the location for this kiosk'}
          </Text>

          {step === 'company' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Company ID"
                placeholderTextColor={colors.textMuted}
                value={companyId}
                onChangeText={setCompanyId}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleConnectCompany}
              />
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleConnectCompany}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Connect</Text>
                )}
              </Pressable>
            </>
          )}

          {step === 'location' && (
            <>
              <Text style={styles.sectionLabel}>Available Locations</Text>
              {locations.map((loc) => (
                <Pressable
                  key={loc.locationId}
                  style={({ pressed }) => [
                    styles.locationRow,
                    selectedLocation?.locationId === loc.locationId && styles.locationRowSelected,
                    pressed && styles.locationRowPressed,
                  ]}
                  onPress={() => setSelectedLocation(loc)}
                  accessible
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedLocation?.locationId === loc.locationId }}
                >
                  <Text style={styles.locationName}>{loc.name}</Text>
                  {loc.address && <Text style={styles.locationAddress}>{loc.address}</Text>}
                </Pressable>
              ))}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  !selectedLocation && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleActivate}
                disabled={!selectedLocation || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Activate Kiosk</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.backLink}
                onPress={() => { setStep('company'); setError(''); }}
              >
                <Text style={styles.backLinkText}>← Change Company</Text>
              </Pressable>
            </>
          )}

          {error !== '' && <Text style={styles.error}>{error}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.md,
    ...shadow.raised,
  },
  logoText: { ...typography.h1, color: colors.primary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { backgroundColor: colors.textMuted },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { ...typography.title, color: colors.textOnPrimary },
  locationRow: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  locationRowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight + '33' },
  locationRowPressed: { opacity: 0.8 },
  locationName: { ...typography.title, color: colors.text },
  locationAddress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  backLink: { alignSelf: 'center', marginTop: spacing.sm },
  backLinkText: { ...typography.label, color: colors.primary },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.xs },
});
