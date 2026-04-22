import { PropsWithChildren } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/styles/tokens';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** 'default' = standard iOS card; 'grouped' = no outer shadow, flush inset */
  variant?: 'default' | 'grouped';
}>;

export default function Card({ children, style, variant = 'default' }: CardProps) {
  return (
    <View style={[
      styles.card,
      variant === 'grouped' && styles.grouped,
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  grouped: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowOpacity: 0,
    elevation: 0,
  },
});
