import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/styles/theme';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

const toneMap = {
  success: { bg: 'rgba(39, 174, 96, 0.12)', text: colors.success },
  warning: { bg: 'rgba(243, 156, 18, 0.12)', text: colors.warning },
  danger: { bg: 'rgba(231, 76, 60, 0.12)', text: colors.danger },
  info: { bg: 'rgba(74, 144, 226, 0.12)', text: colors.primary },
  neutral: { bg: 'rgba(122, 135, 150, 0.12)', text: colors.muted },
};

export default function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const styles = getStyles(tone);
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const getStyles = (tone: BadgeTone) => {
  const t = toneMap[tone];
  return StyleSheet.create({
    badge: {
      backgroundColor: t.bg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    text: {
      ...typography.caption,
      color: t.text,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
  });
};
