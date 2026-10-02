import { StyleSheet, Text, View } from 'react-native';
import { SectionHeader } from '@/components/ui';
import { colors } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import type { LineupPerson } from '@/types/lineup';
import { PersonChip } from './PersonChip';

export function Bench({ people }: { people: LineupPerson[] }) {
  const { t } = useTranslation();
  return (
    <View>
      <SectionHeader title={t('lineup.bench')} />
      {people.length === 0 ? (
        <Text style={styles.empty}>{t('lineup.empty_bench')}</Text>
      ) : (
        <View style={styles.wrap}>
          {people.map((p) => (
            <PersonChip key={p.personId} name={p.name} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { fontSize: 15, color: colors.muted },
});
