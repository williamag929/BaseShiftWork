import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/styles/tokens';

interface ClockButtonProps {
  isClockedIn: boolean;
  loading: boolean;
  onPress: () => void;
  photoUri: string | null;
  onPhotoPress: () => void;
  onRemovePhoto: () => void;
}

export function ClockButton({
  isClockedIn, loading, onPress, photoUri, onPhotoPress, onRemovePhoto,
}: ClockButtonProps) {
  const scale = useSharedValue(1);
  const colorProgress = useSharedValue(isClockedIn ? 1 : 0);

  useEffect(() => {
    colorProgress.value = withTiming(isClockedIn ? 1 : 0, { duration: 400 });
  }, [isClockedIn]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.primary, colors.danger],
    ),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 12, stiffness: 280 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 280 });
  };

  const handlePress = () => {
    onPress();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.container}>
      {!!photoUri && (
        <View style={styles.previewRow}>
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
          <Pressable onPress={onRemovePhoto}>
            <Text style={styles.removePhoto}>Remove photo</Text>
          </Pressable>
        </View>
      )}
      <Pressable style={styles.photoBtn} onPress={onPhotoPress} disabled={loading}>
        <Ionicons name="camera" size={20} color={colors.primary} />
        <Text style={styles.photoBtnText}>{photoUri ? 'Retake Photo' : 'Add Photo (optional)'}</Text>
      </Pressable>

      <Animated.View style={[styles.button, animatedButtonStyle]}>
        <Pressable
          style={styles.buttonInner}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={loading}
        >
          {loading ? (
            <Animated.View style={styles.loadingRing} />
          ) : (
            <>
              <Ionicons name={isClockedIn ? 'log-out' : 'log-in'} size={48} color="#fff" style={{ marginBottom: 8 }} />
              <Text style={styles.buttonText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: 20 },
  previewRow: { alignItems: 'center', marginBottom: 10 },
  preview: { width: 96, height: 96, borderRadius: 8, marginBottom: 6 },
  removePhoto: { color: colors.danger, textDecorationLine: 'underline' },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 16,
  },
  photoBtnText: { color: colors.primary, fontWeight: '600' },
  button: {
    width: 160, height: 160, borderRadius: 80,
    elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  buttonInner: { width: '100%', height: '100%', borderRadius: 80, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  loadingRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)', borderTopColor: '#fff' },
});
