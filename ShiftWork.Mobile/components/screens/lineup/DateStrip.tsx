import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { localToday, shiftDate } from '@/utils/lineup';

type Props = {
  date: string;
  onChange: (date: string) => void;
  confirmDiscard: boolean;
  /** Blocks date changes (e.g. while a commit is in flight). */
  disabled?: boolean;
};

export function DateStrip({ date, onChange, confirmDiscard, disabled = false }: Props) {
  const { t } = useTranslation();

  const change = (next: string) => {
    if (disabled || next === date) return;
    if (!confirmDiscard) {
      onChange(next);
      return;
    }
    Alert.alert(t('lineup.discard_title'), t('lineup.discard_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), style: 'destructive', onPress: () => onChange(next) },
    ]);
  };

  return (
    <View style={styles.row}>
      <PressableScale testID="lineup-prev-day" disabled={disabled} accessibilityLabel={t('lineup.prev_day')} onPress={() => change(shiftDate(date, -1))} style={styles.arrow}>
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </PressableScale>
      <View style={styles.center}>
        <Text style={styles.date}>{date}</Text>
        <PressableScale testID="lineup-today" disabled={disabled} accessibilityLabel={t('lineup.today')} onPress={() => change(localToday())} style={styles.todayBtn}>
          <Text style={styles.today}>{t('lineup.today')}</Text>
        </PressableScale>
      </View>
      <PressableScale testID="lineup-next-day" disabled={disabled} accessibilityLabel={t('lineup.next_day')} onPress={() => change(shiftDate(date, 1))} style={styles.arrow}>
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  arrow: {
    width: touchTarget.min, height: touchTarget.min, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  center: { alignItems: 'center' },
  date: { fontSize: 17, fontWeight: '600', color: colors.text },
  todayBtn: { minHeight: touchTarget.min, minWidth: touchTarget.min, alignItems: 'center', justifyContent: 'center' },
  today: { fontSize: 13, color: colors.primary },
});
