import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PhotoCapture from '@/components/PhotoCapture';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';
import { useProfile } from '@/hooks/useProfile';
import { ProfileHeader } from '@/components/screens/profile/ProfileHeader';
import { ProfileInfoSection } from '@/components/screens/profile/ProfileInfoSection';
import { SecuritySection } from '@/components/screens/profile/SecuritySection';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation, SupportedLocale } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { peopleService } from '@/services/people.service';

export default function ProfileScreen() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { t, locale, setLocale } = useTranslation();
  const { companyId, personId } = useAuthStore();

  const languages: { code: SupportedLocale; label: string }[] = [
    { code: 'en', label: t('profile.language_en') },
    { code: 'es', label: t('profile.language_es') },
  ];

  const selectLanguage = (code: SupportedLocale) => {
    Haptics.selectionAsync();
    setLocale(code);
    // Fire-and-forget server sync so pushes and other devices follow the choice
    if (companyId && personId) {
      peopleService
        .partialUpdatePerson(companyId, personId, { preferredLanguage: code })
        .catch(() => {});
    }
  };

  if (profile.loading && !profile.person) {
    return (
      <View style={styles.center}>
        <Skeleton width={90} height={90} borderRadius={45} />
        <Skeleton width={160} height={18} borderRadius={6} style={{ marginTop: 16 }} />
        <Skeleton width={200} height={14} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={profile.onRefresh} />}
    >
      <StatusBar style="light" />
      <ProfileHeader
        name={profile.person?.name || ''}
        email={profile.person?.email || ''}
        photoUrl={profile.photoUrl}
        uploadingPhoto={profile.uploadingPhoto}
        onPhotoPress={() => profile.setShowPhotoCapture(true)}
      />
      <PhotoCapture
        visible={profile.showPhotoCapture}
        onClose={() => profile.setShowPhotoCapture(false)}
        onCaptured={profile.handlePhotoCapture}
      />

      <Animated.View entering={FadeInDown.delay(100).duration(350)}>
        <ProfileInfoSection profile={profile} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(350)}>
        <SecuritySection profile={profile} />
      </Animated.View>

      {/* Language */}
      <Animated.View entering={FadeInDown.delay(220).duration(350)} style={styles.languageSection}>
        <View style={styles.languageCard}>
          <View style={styles.languageHeader}>
            <View style={styles.languageIconWrap}>
              <Ionicons name="language-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.languageTitle}>{t('profile.language')}</Text>
          </View>
          <View style={styles.languageOptions}>
            {languages.map((lang) => (
              <PressableScale
                key={lang.code}
                style={[styles.languageOption, locale === lang.code && styles.languageOptionActive]}
                onPress={() => selectLanguage(lang.code)}
              >
                <Text style={[styles.languageOptionText, locale === lang.code && styles.languageOptionTextActive]}>
                  {lang.label}
                </Text>
                {locale === lang.code && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                )}
              </PressableScale>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Sign out */}
      <Animated.View entering={FadeInDown.delay(260).duration(350)} style={styles.signOutSection}>
        <PressableScale
          style={styles.signOutRow}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            profile.handleSignOut();
          }}
        >
          <View style={styles.signOutIconWrap}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
        </PressableScale>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('profile.footer')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  languageSection: { paddingHorizontal: spacing.lg, paddingTop: 16 },
  languageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  languageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  languageIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  languageTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  languageOptions: { flexDirection: 'row', gap: 10 },
  languageOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radius.lg ?? 12,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  languageOptionActive: { borderColor: colors.primary, backgroundColor: 'rgba(0,122,255,0.08)' },
  languageOptionText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  languageOptionTextActive: { color: colors.primary },
  signOutSection: { paddingHorizontal: spacing.lg, paddingTop: 16 },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,59,48,0.07)',
    borderRadius: radius.xl, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.14)',
  },
  signOutIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  footer: { paddingVertical: 28, alignItems: 'center' },
  footerText: { fontSize: 12, color: colors.muted },
});
