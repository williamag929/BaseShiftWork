import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';

export type ChipVariant = 'saved' | 'drafted' | 'removed';

type Props = {
  name: string;
  detail?: string;
  muted?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
  testID?: string;
};

export function PersonChip({ name, detail, muted, variant = 'saved', onPress, testID }: Props) {
  const style = [
    styles.chip,
    muted && styles.muted,
    variant === 'drafted' && styles.drafted,
    variant === 'removed' && styles.removed,
  ];
  const content = (
    <>
      <Text style={[styles.name, muted && styles.mutedText, variant === 'removed' && styles.removedText]}>{name}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={style}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={name} onPress={onPress} style={style}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg,
    backgroundColor: colors.fill, marginRight: spacing.sm, marginBottom: spacing.sm,
    minHeight: touchTarget.min, justifyContent: 'center',
  },
  muted: { opacity: 0.6 },
  drafted: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' },
  removed: { backgroundColor: colors.dangerLight, opacity: 0.8 },
  name: { fontSize: 15, fontWeight: '500', color: colors.text },
  mutedText: { color: colors.muted },
  removedText: { textDecorationLine: 'line-through', color: colors.danger },
  detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
