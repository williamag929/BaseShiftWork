import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
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
  return (
    <View style={styles.container}>
      {!!photoUri && (
        <View style={styles.previewRow}>
          <Image source={{ uri: photoUri }} style={styles.preview} />
          <Pressable onPress={onRemovePhoto}>
            <Text style={styles.removePhoto}>Remove photo</Text>
          </Pressable>
        </View>
      )}
      <Pressable style={styles.photoBtn} onPress={onPhotoPress} disabled={loading}>
        <Ionicons name="camera" size={20} color={colors.primary} />
        <Text style={styles.photoBtnText}>{photoUri ? 'Retake Photo' : 'Add Photo (optional)'}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          isClockedIn ? styles.clockOutBtn : styles.clockInBtn,
          pressed && { opacity: 0.85 },
        ]}
        onPress={onPress}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <>
            <Ionicons name={isClockedIn ? 'log-out' : 'log-in'} size={48} color="#fff" style={{ marginBottom: 8 }} />
            <Text style={styles.buttonText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
          </>
        )}
      </Pressable>
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
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  clockInBtn: { backgroundColor: colors.primary },
  clockOutBtn: { backgroundColor: colors.danger },
  buttonText: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
});
