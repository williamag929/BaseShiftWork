import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '@/styles/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
  /** 'grouped' matches iOS UITableView grouped section header style */
  variant?: 'default' | 'grouped';
};

export default function SectionHeader({
  title,
  subtitle,
  rightSlot,
  style,
  variant = 'default',
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, variant === 'grouped' && styles.grouped, style]}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, variant === 'grouped' && styles.titleGrouped]}>
          {title}
        </Text>
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
    paddingVertical: 6,
  },
  grouped: {
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
    paddingBottom: 6,
  },
  textBlock: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
    letterSpacing: -0.4,
  },
  titleGrouped: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.muted,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: colors.muted,
  },
}); 
