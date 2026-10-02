import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';
import type { LineupCrew } from '@/types/lineup';

type Props = { crews: LineupCrew[]; onPick: (crewId: number) => void };

export function CrewPicker({ crews, onPick }: Props) {
  return (
    <View style={styles.wrap}>
      {crews.map((c) => (
        <PressableScale
          key={c.crewId}
          testID={`crew-pick-${c.crewId}`}
          accessibilityRole="button"
          accessibilityLabel={c.name}
          onPress={() => onPick(c.crewId)}
          style={styles.item}
        >
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.count}>{c.memberIds.length}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  item: {
    minHeight: touchTarget.min, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center',
    marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  name: { fontSize: 15, color: colors.text, fontWeight: '500' },
  count: { fontSize: 13, color: colors.muted, marginLeft: spacing.sm },
});
