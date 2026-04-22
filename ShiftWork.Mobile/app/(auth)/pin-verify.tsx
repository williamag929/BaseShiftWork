import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useSharedValue,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/styles/tokens';

const PIN_LENGTH = 4;
const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

export default function PinVerifyScreen() {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10,  { duration: 60 }),
      withTiming(-7,  { duration: 60 }),
      withTiming(7,   { duration: 60 }),
      withTiming(0,   { duration: 60 }),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const handleDigit = (key: string) => {
    if (key === 'del') {
      setPin(p => p.slice(0, -1));
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (key === '') return;
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (next.length === PIN_LENGTH) {
      // TODO: validate against API
      setError('Invalid PIN. Please try again.');
      triggerShake();
      setTimeout(() => setPin(''), 600);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Animated.View entering={FadeIn.duration(350)} style={styles.content}>
        {/* Lock icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Enter Your PIN</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN to continue</Text>

        {/* Dot indicators */}
        <Animated.View style={[styles.dotsRow, shakeStyle]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          ))}
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Numpad */}
        <View style={styles.numpad}>
          {NUMPAD.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.key,
                    key === '' && styles.keyInvisible,
                    key === 'del' && styles.keyDel,
                    pressed && key !== '' && styles.keyPressed,
                  ]}
                  onPress={() => handleDigit(key)}
                  disabled={key === ''}
                  accessible
                  accessibilityLabel={key === 'del' ? 'Delete' : key}
                >
                  {key === 'del' ? (
                    <Ionicons name="backspace-outline" size={22} color={colors.text} />
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  content: { flex: 1, alignItems: 'center', width: '100%', maxWidth: 360, paddingHorizontal: 24 },

  iconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5, marginBottom: 8,
  },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 36 },

  dotsRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotFilled: { backgroundColor: colors.primary },
  dotEmpty: { backgroundColor: colors.borderOpaque, borderWidth: 1.5, borderColor: colors.borderOpaque },

  errorText: { fontSize: 14, color: colors.danger, marginBottom: 20, fontWeight: '500' },

  numpad: { width: '100%', gap: 12, marginTop: 16 },
  numpadRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  key: {
    width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  keyInvisible: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
  keyDel: { backgroundColor: colors.fill },
  keyPressed: { backgroundColor: colors.fillSecondary, opacity: 0.75 },
  keyText: { fontSize: 26, fontWeight: '400', color: colors.text, letterSpacing: -0.3 },
});
