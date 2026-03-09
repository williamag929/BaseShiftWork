import { PropsWithChildren } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/styles/tokens';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export default function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    ...shadow.card,
  },
});
