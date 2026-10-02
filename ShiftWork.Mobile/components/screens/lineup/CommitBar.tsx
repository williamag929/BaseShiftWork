import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';
import { useTranslation } from '@/i18n';

type Props = { count: number; pending: boolean; offline: boolean; onCommit: () => void };

export function CommitBar({ count, pending, offline, onCommit }: Props) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  const disabled = pending || offline;
  return (
    <View style={styles.bar}>
      <PressableScale
        testID="commit-button"
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: pending }}
        disabled={disabled}
        onPress={() => {
          if (!disabled) onCommit();
        }}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.label}>{pending ? t('common.loading') : t('lineup.publish', { count })}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  button: { minHeight: touchTarget.min, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  label: { color: colors.onPrimary, fontSize: 17, fontWeight: '600' },
});
