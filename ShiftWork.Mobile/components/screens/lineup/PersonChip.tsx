import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

export type ChipVariant = 'saved' | 'drafted' | 'removed' | 'rejected' | 'warning';

type Props = {
  name: string;
  detail?: string;
  muted?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
  testID?: string;
};

const STATE_KEY: Partial<Record<ChipVariant, string>> = {
  saved: 'lineup.state_saved',
  drafted: 'lineup.state_drafted',
  removed: 'lineup.state_removed',
  rejected: 'lineup.state_rejected',
  warning: 'lineup.state_warning',
};

export function PersonChip({ name, detail, muted, variant = 'saved', onPress, testID }: Props) {
  const { t } = useTranslation();
  const label = [name, detail, t(STATE_KEY[variant] ?? 'lineup.state_saved')].filter(Boolean).join(', ');
  const style = [
    styles.chip,
    muted && styles.muted,
    variant === 'drafted' && styles.drafted,
    variant === 'removed' && styles.removed,
    variant === 'rejected' && styles.rejected,
    variant === 'warning' && styles.warning,
  ];
  const content = (
    <>
      <Text style={[styles.name, muted && styles.mutedText, variant === 'removed' && styles.removedText]}>{name}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={label} style={style}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
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
  rejected: { backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger },
  warning: { backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning },
  name: { fontSize: 15, fontWeight: '500', color: colors.text },
  mutedText: { color: colors.muted },
  removedText: { textDecorationLine: 'line-through', color: colors.danger },
  detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
