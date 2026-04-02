import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography } from '@/styles/tokens';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PinPadProps {
  value: string;
  maxLength?: number;
  onChange: (pin: string) => void;
  onSubmit?: (pin: string) => void;
  style?: ViewStyle;
  error?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export function PinPad({
  value,
  maxLength = 4,
  onChange,
  onSubmit,
  style,
  error = false,
}: PinPadProps) {
  const shakeX = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  React.useEffect(() => {
    if (error) shake();
  }, [error, shake]);

  const handleKey = useCallback(
    async (key: string) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (key === 'del') {
        onChange(value.slice(0, -1));
      } else if (key !== '' && value.length < maxLength) {
        const next = value + key;
        onChange(next);
        if (next.length === maxLength) {
          onSubmit?.(next);
        }
      }
    },
    [value, maxLength, onChange, onSubmit]
  );

  return (
    <View style={[styles.container, style]}>
      {/* PIN dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeX }] }]}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < value.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </Animated.View>

      {/* Key grid */}
      <View style={styles.grid}>
        {KEYS.map((key, idx) => {
          if (key === '') return <View key={idx} style={styles.key} />;
          return (
            <Pressable
              key={idx}
              style={({ pressed }) => [
                styles.key,
                styles.keyButton,
                pressed && styles.keyPressed,
              ]}
              onPress={() => handleKey(key)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key}
            >
              {key === 'del' ? (
                <Ionicons name="backspace-outline" size={28} color={colors.text} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 300,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  key: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  keyPressed: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  keyText: {
    ...typography.h2,
    color: colors.text,
  },
});
