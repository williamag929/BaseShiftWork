import { View } from 'react-native';
import { SectionHeader } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { reasonKey } from '@/utils/lineup';
import type { LineupUnavailable } from '@/types/lineup';
import { PersonChip } from './PersonChip';

export function UnavailableList({ people }: { people: LineupUnavailable[] }) {
  const { t } = useTranslation();
  if (people.length === 0) return null;
  return (
    <View>
      <SectionHeader title={t('lineup.unavailable')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {people.map((p) => {
          const key = reasonKey(p.reason);
          return <PersonChip key={p.personId} name={p.name} detail={key ? t(key) : p.reason} muted />;
        })}
      </View>
    </View>
  );
}
