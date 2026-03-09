import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import PhotoCapture from '@/components/PhotoCapture';
import { Card } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, spacing } from '@/styles/tokens';
import { useProfile } from '@/hooks/useProfile';
import { ProfileHeader } from '@/components/screens/profile/ProfileHeader';
import { ProfileInfoSection } from '@/components/screens/profile/ProfileInfoSection';
import { SecuritySection } from '@/components/screens/profile/SecuritySection';

export default function ProfileScreen() {
  const profile = useProfile();

  if (profile.loading && !profile.person) {
    return (
      <View style={styles.center}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <Skeleton width={160} height={18} borderRadius={6} style={{ marginTop: 16 }} />
        <Skeleton width={200} height={14} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={profile.onRefresh} />}>
      <StatusBar style="light" />
      <ProfileHeader name={profile.person?.name || ''} email={profile.person?.email || ''} photoUrl={profile.photoUrl} uploadingPhoto={profile.uploadingPhoto} onPhotoPress={() => profile.setShowPhotoCapture(true)} />
      <PhotoCapture visible={profile.showPhotoCapture} onClose={() => profile.setShowPhotoCapture(false)} onCaptured={profile.handlePhotoCapture} />
      <ProfileInfoSection profile={profile} />
      <SecuritySection profile={profile} />
      <View style={styles.section}>
        <Card style={styles.card}>
          <Pressable onPress={profile.handleSignOut} style={styles.dangerOption}>
            <Ionicons name="log-out" size={24} color={colors.danger} />
            <Text style={styles.dangerText}>Sign Out</Text>
          </Pressable>
        </Card>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>ShiftWork Mobile</Text>
        <Text style={styles.footerText}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, color: colors.muted, fontSize: 14 },
  section: { padding: spacing.md },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, elevation: 1 },
  dangerOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  dangerText: { fontSize: 16, fontWeight: '600', color: colors.danger },
  footer: { padding: 32, alignItems: 'center' },
  footerText: { fontSize: 12, color: colors.muted, marginBottom: 4 },
});

