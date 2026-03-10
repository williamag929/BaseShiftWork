import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, ToastMessage, ToastType } from '@/hooks/useToast';
import { colors, spacing, radius, typography, zIndex } from '@/styles/tokens';

// ─── Single toast item ────────────────────────────────────────────────────────

const TOAST_BG: Record<ToastType, string> = {
  success: colors.success,
  error: colors.danger,
  warning: colors.warning,
  info: colors.primary,
};

const TOAST_ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(-80, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.toast, { backgroundColor: TOAST_BG[toast.type] }, animStyle]}>
      <Text style={styles.icon}>{TOAST_ICON[toast.type]}</Text>
      <Text style={styles.message} numberOfLines={3}>{toast.message}</Text>
      <Pressable onPress={handleDismiss} hitSlop={8} accessibilityLabel="Dismiss notification">
        <Text style={styles.close}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Container — place once in root _layout.tsx return ───────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: zIndex.toast,
    gap: spacing.xs,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  icon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: spacing.sm,
    minWidth: 20,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: '#fff',
    flex: 1,
  },
  close: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 22,
    marginLeft: spacing.sm,
    opacity: 0.8,
  },
});
