import { Stack, useRouter } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useDeviceStore } from '@/store/deviceStore';
import { useSessionStore } from '@/store/sessionStore';
import { kioskService } from '@/services/kiosk.service';
import { colors, spacing, typography, zIndex } from '@/styles/tokens';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '@/i18n';

function LanguageToggle() {
  const { locale, setLocale } = useTranslation();

  return (
    <View style={styles.langToggle}>
      {(['en', 'es'] as const).map((code) => (
        <Pressable
          key={code}
          style={[styles.langBtn, locale === code && styles.langBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setLocale(code);
          }}
          accessible
          accessibilityRole="button"
          accessibilityState={{ selected: locale === code }}
        >
          <Text style={[styles.langText, locale === code && styles.langTextActive]}>
            {code.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function KioskHeader() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const locationName = useDeviceStore((s) => s.locationName);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formattedTime = time.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const formattedDate = time.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.clock}>{formattedTime}</Text>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      <Text style={styles.location} numberOfLines={1}>
        {locationName}
      </Text>

      <View style={styles.headerRight}>
        <LanguageToggle />
        <Pressable
          style={({ pressed }) => [styles.adminBtn, pressed && styles.adminBtnPressed]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(admin)');
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('kiosk_app.admin_aria')}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function KioskLayout() {
  const resetSession = useSessionStore((s) => s.reset);
  const companyId = useDeviceStore((s) => s.companyId);
  const { applyServerLocale } = useTranslation();

  // Reset the per-transaction session whenever we navigate back to this scope
  useEffect(() => {
    resetSession();
  }, [resetSession]);

  // Seed the locale from CompanySettings.DefaultLanguage when no one has
  // toggled the language on this device yet
  useEffect(() => {
    if (!companyId) return;
    kioskService
      .getDefaultLanguage(companyId)
      .then(applyServerLocale)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <View style={styles.root}>
      <KioskHeader />
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    zIndex: zIndex.header,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  headerLeft: { flex: 1 },
  clock: {
    fontSize: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
    color: colors.text,
  },
  date: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  location: {
    flex: 2,
    fontSize: 15,
    fontWeight: '500' as const,
    letterSpacing: -0.24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.separator,
    overflow: 'hidden',
  },
  langBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 44,
    alignItems: 'center',
  },
  langBtnActive: { backgroundColor: colors.primary },
  langText: { ...typography.label, color: colors.textMuted },
  langTextActive: { color: colors.textOnPrimary },
  adminBtn: {
    padding: spacing.sm,
  },
  adminBtnPressed: { opacity: 0.4 },
  content: { flex: 1 },
});
