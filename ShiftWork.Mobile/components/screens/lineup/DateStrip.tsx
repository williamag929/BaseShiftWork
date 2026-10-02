import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { localToday, shiftDate } from '@/utils/lineup';

type Props = {
  date: string;
  onChange: (date: string) => void;
  confirmDiscard: boolean;
};

export function DateStrip({ date, onChange, confirmDiscard }: Props) {
  const { t } = useTranslation();

  const change = (next: string) => {
    if (next === date) return;
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
      <PressableScale accessibilityLabel="prev-day" onPress={() => change(shiftDate(date, -1))} style={styles.arrow}>
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </PressableScale>
      <View style={styles.center}>
        <Text style={styles.date}>{date}</Text>
        <PressableScale accessibilityLabel="today" onPress={() => change(localToday())}>
          <Text style={styles.today}>{t('lineup.today')}</Text>
        </PressableScale>
      </View>
      <PressableScale accessibilityLabel="next-day" onPress={() => change(shiftDate(date, 1))} style={styles.arrow}>
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  arrow: {
    width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  center: { alignItems: 'center' },
  date: { fontSize: 17, fontWeight: '600', color: colors.text },
  today: { fontSize: 13, color: colors.primary, marginTop: 2 },
});
