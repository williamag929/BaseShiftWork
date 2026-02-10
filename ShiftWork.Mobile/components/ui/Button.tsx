import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/styles/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
};

export default function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const containerStyle = [
    styles.base,
    styles[variant],
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [styles.label, styles[`label_${variant}`]];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={containerStyle}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: '#EAF2FD',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...typography.subtitle,
  },
  label_primary: {
    color: '#fff',
  },
  label_secondary: {
    color: colors.primary,
  },
  label_ghost: {
    color: colors.primary,
  },
  label_danger: {
    color: '#fff',
  },
});
