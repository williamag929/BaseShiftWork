import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { wallTime, type LineupView } from '@/utils/lineup';
import { PersonChip } from './PersonChip';

type Props = { location: LineupView['locations'][number] };

export function LocationCard({ location }: Props) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{location.name}</Text>
        <Text style={styles.count}>{t('lineup.people_count', { count: location.count })}</Text>
      </View>
      <View style={styles.people}>
        {location.saved.map((s) => (
          <PersonChip key={`s${s.shiftId}`} name={s.name} detail={`${wallTime(s.start)}–${wallTime(s.end)}`} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  name: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1 },
  count: { fontSize: 13, color: colors.muted },
  people: { flexDirection: 'row', flexWrap: 'wrap' },
});
