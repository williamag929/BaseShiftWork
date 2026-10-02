import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/styles/tokens';

type Props = { name: string; detail?: string; muted?: boolean };

export function PersonChip({ name, detail, muted }: Props) {
  return (
    <View style={[styles.chip, muted && styles.muted]}>
      <Text style={[styles.name, muted && styles.mutedText]}>{name}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg,
    backgroundColor: colors.fill, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  muted: { opacity: 0.6 },
  name: { fontSize: 15, fontWeight: '500', color: colors.text },
  mutedText: { color: colors.muted },
  detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
