import { ActivityIndicator, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, typography } from '@/styles/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
  fullWidth?: boolean;
};

export default function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  style,
  fullWidth = true,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 400 });
  };
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const containerStyles = [
    styles.base,
    sizeStyles[size],
    variantStyles[variant],
    (disabled || loading) && styles.disabled,
    !fullWidth && { alignSelf: 'center' as const },
    style,
  ];

  const textColor = variant === 'secondary' || variant === 'ghost'
    ? colors.primary
    : '#FFFFFF';

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[animatedStyle, containerStyles]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor }, size === 'sm' && styles.labelSm]}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const variantStyles: Record<string, ViewStyle> = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
});

const sizeStyles: Record<string, ViewStyle> = StyleSheet.create({
  sm: { paddingVertical: 10, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  md: { paddingVertical: 15, paddingHorizontal: spacing.xl, borderRadius: radius.lg },
  lg: { paddingVertical: 18, paddingHorizontal: spacing.xxl, borderRadius: radius.lg },
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  disabled: { opacity: 0.45 },
  label: {
    ...typography.headline,
    color: '#fff',
    letterSpacing: -0.3,
  },
  labelSm: { fontSize: 15, fontWeight: '600' as const },
});
