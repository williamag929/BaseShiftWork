import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { useNfcTagLinks } from '@/hooks/queries';
import { useNfcAvailability } from '@/hooks/useNfcAvailability';

/** Shown to managers (the tag-link list loads only with locations.update) on phones that can read NFC. */
export function NfcWriteTagEntry({ companyId }: { companyId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useNfcTagLinks(companyId);
  const availability = useNfcAvailability();

  if (!data || availability === null || availability === 'unsupported') return null;

  return (
    <View style={styles.section}>
      <Pressable style={styles.row} onPress={() => router.push('/nfc/write-tag' as any)} accessibilityRole="button">
        <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
        <Text style={styles.label}>{t('nfc.write_entry')}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.surface,
  },
  label: { flex: 1, fontSize: 16, color: colors.text },
});
