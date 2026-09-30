import { View, Text, StyleSheet } from 'react-native';
import { useOutboxStatus } from '@/services/outbox';
import { colors, spacing, radius, typography } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

/** Admin-only: how many punches are waiting to send, could not be sent, or have piled up too long. */
export function OutboxStatusCard() {
  const { t } = useTranslation();
  const { pendingCount, failedCount, overCap } = useOutboxStatus();

  if (pendingCount === 0 && failedCount === 0 && !overCap) return null;

  return (
    <View style={styles.card}>
      {pendingCount > 0 && (
        <Text style={styles.text}>{t('kiosk_app.sync_waiting', { count: pendingCount })}</Text>
      )}
      {failedCount > 0 && (
        <Text style={[styles.text, styles.bad]}>{t('kiosk_app.sync_failed', { count: failedCount })}</Text>
      )}
      {overCap && <Text style={[styles.text, styles.bad]}>{t('kiosk_app.sync_over_cap')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  text: { ...typography.body, color: colors.text },
  bad: { color: colors.danger },
});
