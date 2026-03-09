import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/styles/tokens';

interface ProfileHeaderProps {
  name: string;
  email: string;
  photoUrl: string;
  uploadingPhoto: boolean;
  onPhotoPress: () => void;
}

export function ProfileHeader({ name, email, photoUrl, uploadingPhoto, onPhotoPress }: ProfileHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.avatarContainer} onPress={onPhotoPress} disabled={uploadingPhoto}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={80} color={colors.primary} />
        )}
        <View style={styles.cameraIcon}>
          {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={20} color="#fff" />}
        </View>
      </Pressable>
      <Text style={styles.name}>{name || 'No Name'}</Text>
      <Text style={styles.email}>{email || 'No email on file'}</Text>
      <Text style={styles.hint}>{uploadingPhoto ? 'Uploading photo...' : 'Tap photo to update'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, padding: spacing.xl, alignItems: 'center' },
  avatarContainer: { marginBottom: spacing.md, position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#fff' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 6 },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
});
