import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import type { NfcPunchErrorKind, NfcPunchState } from '@/hooks/useNfcPunch';

const ERROR_TEXT: Record<NfcPunchErrorKind, string> = {
  offline: 'nfc.error_offline',
  unknown_tag: 'nfc.error_unknown_tag',
  signed_out: 'nfc.sign_in_first',
  failed: 'nfc.error_failed',
};

interface Props {
  state: NfcPunchState;
  onRetry: () => void;
  onDone: () => void;
}

export function NfcPunchResultView({ state, onRetry, onDone }: Props) {
  const { t } = useTranslation();

  if (state.status === 'idle' || state.status === 'sending') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.subtitle}>{t('nfc.sending')}</Text>
      </View>
    );
  }

  if (state.status === 'success') {
    const { result } = state;
    const isIn = result.eventType === 'clockin';
    const time = new Date(result.eventDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return (
      <View style={styles.center}>
        <Ionicons name={isIn ? 'log-in-outline' : 'log-out-outline'} size={96} color={isIn ? colors.success : colors.primary} />
        <Text style={styles.title}>{t(isIn ? 'nfc.clocked_in' : 'nfc.clocked_out')}</Text>
        <Text style={styles.subtitle}>{t('nfc.at_site_time', { site: result.locationName, time })}</Text>
        {result.repeated && <Text style={styles.note}>{t('nfc.already_recorded')}</Text>}
        {result.geofenceStatus === 'Outside' && <Text style={[styles.note, styles.warning]}>{t('nfc.outside_site')}</Text>}
        <Button label={t('nfc.done')} onPress={onDone} size="lg" fullWidth style={styles.button} />
      </View>
    );
  }

  const canRetry = state.kind === 'offline' || state.kind === 'failed';
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={96} color={colors.danger} />
      <Text style={styles.title}>{t(ERROR_TEXT[state.kind])}</Text>
      {state.kind === 'failed' && !!state.message && <Text style={styles.note}>{state.message}</Text>}
      {canRetry && <Button label={t('nfc.try_again')} onPress={onRetry} size="lg" fullWidth style={styles.button} />}
      <Button label={t('nfc.done')} onPress={onDone} variant="ghost" fullWidth style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.background },
  title: { fontSize: 30, fontWeight: '700', color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  subtitle: { fontSize: 18, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  note: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  warning: { color: colors.warning },
  button: { marginTop: spacing.xl },
});
