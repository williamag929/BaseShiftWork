import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/styles/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
};

export default function SectionHeader({ title, subtitle, rightSlot, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    ...typography.caption,
    color: colors.muted,
  },
});
