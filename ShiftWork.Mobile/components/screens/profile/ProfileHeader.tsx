import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';

interface ProfileHeaderProps {
  name: string;
  email: string;
  photoUrl: string;
  uploadingPhoto: boolean;
  onPhotoPress: () => void;
}

export function ProfileHeader({ name, email, photoUrl, uploadingPhoto, onPhotoPress }: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();
  const initials = name.trim().split(' ').map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.inner}>
        {/* Avatar */}
        <PressableScale style={styles.avatarWrap} onPress={onPhotoPress} disabled={uploadingPhoto}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <View style={styles.initials}>
              <Text style={styles.initialsText}>{initials || '?'}</Text>
            </View>
          )}
          <View style={styles.cameraChip}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera" size={14} color="#fff" />}
          </View>
        </PressableScale>

        {/* Identity */}
        <Text style={styles.name}>{name || 'No Name'}</Text>
        <Text style={styles.email}>{email || 'No email on file'}</Text>
        <Text style={styles.hint}>{uploadingPhoto ? 'Uploading...' : 'Tap to change photo'}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl, paddingBottom: 36,
    alignItems: 'center',
  },
  inner: { alignItems: 'center' },
  avatarWrap: { marginBottom: 14, position: 'relative' },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
  },
  initials: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
  },
  initialsText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  cameraChip: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: colors.primary,
    borderRadius: 14, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  name:  { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3, marginBottom: 3 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.80)' },
  hint:  { fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 4 },
});
