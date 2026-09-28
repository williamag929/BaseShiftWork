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
import { useTranslation } from '@/i18n';
import type { KioskLocation } from '@/types';

type Step = 'login' | 'company' | 'location';

const DEFAULT_COMPANY_ID = process.env.EXPO_PUBLIC_DEFAULT_COMPANY_ID ?? '';

export default function SetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const enroll = useDeviceStore((s) => s.enroll);

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [locations, setLocations] = useState<KioskLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<KioskLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /** Look up user by email → resolve companyId and jump to location step */
  const handleLogin = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('kiosk_app.enter_email'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await kioskService.getUserByEmail(trimmed);
      if (!user.companyId) {
        setError(t('kiosk_app.no_company_assigned'));
        return;
      }
      setCompanyId(user.companyId);
      // Fetch locations for the resolved company
      const locs = await kioskService.getLocations(user.companyId);
      setLocations(locs.filter((l) => l.isActive));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('location');
    } catch (e) {
      logger.error('[Setup] Login lookup failed', e);
      setError(t('kiosk_app.user_not_found'));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [email, t]);

  const handleConnectCompany = useCallback(async () => {
    if (!companyId.trim()) {
      setError(t('kiosk_app.enter_company_id'));
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
      setError(t('kiosk_app.connect_failed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  const handleActivate = useCallback(async () => {
    if (!selectedLocation) {
      setError(t('kiosk_app.select_location_error'));
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
      setError(t('kiosk_app.activate_failed'));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, companyId, enroll, router, t]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logoText}>ShiftWork Kiosk</Text>
          <Text style={styles.subtitle}>
            {step === 'login'
              ? t('kiosk_app.setup_login_subtitle')
              : step === 'company'
                ? t('kiosk_app.setup_company_subtitle')
                : t('kiosk_app.setup_location_subtitle')}
          </Text>

          {step === 'login' && (
            <>
              <TextInput
                style={styles.input}
                placeholder={t('kiosk_app.email_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>{t('kiosk_app.sign_in')}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.backLink}
                onPress={() => { setStep('company'); setError(''); }}
              >
                <Text style={styles.backLinkText}>{t('kiosk_app.manual_company_link')}</Text>
              </Pressable>
            </>
          )}

          {step === 'company' && (
            <>
              <TextInput
                style={styles.input}
                placeholder={t('kiosk_app.company_id_placeholder')}
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
                  <Text style={styles.buttonText}>{t('kiosk_app.connect')}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.backLink}
                onPress={() => { setStep('login'); setError(''); }}
              >
                <Text style={styles.backLinkText}>{t('kiosk_app.email_signin_link')}</Text>
              </Pressable>
            </>
          )}

          {step === 'location' && (
            <>
              <Text style={styles.sectionLabel}>{t('kiosk_app.available_locations')}</Text>
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
                  <Text style={styles.buttonText}>{t('kiosk_app.activate_kiosk')}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.backLink}
                onPress={() => { setStep('login'); setError(''); setSelectedLocation(null); }}
              >
                <Text style={styles.backLinkText}>{t('kiosk_app.start_over')}</Text>
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
