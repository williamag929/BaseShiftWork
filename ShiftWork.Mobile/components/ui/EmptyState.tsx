import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '@/styles/theme';

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function EmptyState({ title, message, icon = 'calendar-clear-outline' }: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  message: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
  },
});
