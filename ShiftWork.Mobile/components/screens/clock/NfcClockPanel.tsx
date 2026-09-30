import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import type { NfcAvailability } from '@/services/nfc.service';

interface Props {
  siteName: string | null;
  /** The site rejects the phone's clock button; the tag is the only way to punch. */
  required: boolean;
  availability: NfcAvailability | null;
  scanning: boolean;
  onScan: () => void;
}

export function NfcClockPanel({ siteName, required, availability, scanning, onScan }: Props) {
  const { t } = useTranslation();
  const canScan = availability === 'ready';

  if (!required && !canScan) return null;

  return (
    <View style={styles.card}>
      {required && (
        <View style={styles.header}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
          <Text style={styles.title}>
            {siteName ? t('nfc.required_at_site', { site: siteName }) : t('nfc.tap_title')}
          </Text>
        </View>
      )}
      {required && availability === 'unsupported' && <Text style={styles.message}>{t('nfc.unsupported')}</Text>}
      {availability === 'disabled' && <Text style={styles.message}>{t('nfc.disabled')}</Text>}
      {canScan && (
        <Button label={t('nfc.scan_button')} onPress={onScan} loading={scanning} size="lg" fullWidth variant={required ? 'primary' : 'secondary'} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text },
  message: { fontSize: 15, color: colors.textSecondary },
});
