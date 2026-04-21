import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '@/styles/tokens';
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

// iOS-style alphabet sub-labels for digits 2–9
const SUB_LABELS: Record<string, string> = {
  '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
  '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
};

const KEY_SIZE = 82;

// ─── AnimatedKey ──────────────────────────────────────────────────────────────
function AnimatedKey({ keyValue, onPress }: { keyValue: string; onPress: (k: string) => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.88, { damping: 10, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  }, [scale]);

  const isDel = keyValue === 'del';
  const subLabel = SUB_LABELS[keyValue];

  return (
    <Reanimated.View style={[styles.keyOuter, animStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.key,
          pressed && styles.keyPressed,
          isDel && styles.keyDel,
        ]}
        onPress={() => onPress(keyValue)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessible
        accessibilityRole="button"
        accessibilityLabel={isDel ? 'Delete' : keyValue}
      >
        {isDel ? (
          <Ionicons name="backspace-outline" size={26} color={colors.text} />
        ) : (
          <View style={styles.keyInner}>
            <Text style={styles.keyDigit}>{keyValue}</Text>
            {subLabel ? <Text style={styles.keySub}>{subLabel}</Text> : null}
          </View>
        )}
      </Pressable>
    </Reanimated.View>
  );
}

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
      Animated.timing(shakeX, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 12, duration: 50, useNativeDriver: true }),
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
          if (key === '') return <View key={idx} style={styles.keyOuter} />;
          return <AnimatedKey key={idx} keyValue={key} onPress={handleKey} />;
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'rgba(235,235,245,0.5)',
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
    gap: spacing.md,
    justifyContent: 'center',
    width: KEY_SIZE * 3 + spacing.md * 2,
  },
  keyOuter: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.13)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  keyDel: {
    backgroundColor: 'transparent',
  },
  keyInner: {
    alignItems: 'center',
    gap: 0,
  },
  keyDigit: {
    fontSize: 30,
    fontWeight: '300' as const,
    color: colors.text,
    lineHeight: 34,
  },
  keySub: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    lineHeight: 12,
  },
});

