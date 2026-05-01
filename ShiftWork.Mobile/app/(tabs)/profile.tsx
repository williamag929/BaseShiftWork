import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PhotoCapture from '@/components/PhotoCapture';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';
import { useProfile } from '@/hooks/useProfile';
import { ProfileHeader } from '@/components/screens/profile/ProfileHeader';
import { ProfileInfoSection } from '@/components/screens/profile/ProfileInfoSection';
import { SecuritySection } from '@/components/screens/profile/SecuritySection';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();

  if (profile.loading && !profile.person) {
    return (
      <View style={styles.center}>
        <Skeleton width={90} height={90} borderRadius={45} />
        <Skeleton width={160} height={18} borderRadius={6} style={{ marginTop: 16 }} />
        <Skeleton width={200} height={14} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={profile.onRefresh} />}
    >
      <StatusBar style="light" />
      <ProfileHeader
        name={profile.person?.name || ''}
        email={profile.person?.email || ''}
        photoUrl={profile.photoUrl}
        uploadingPhoto={profile.uploadingPhoto}
        onPhotoPress={() => profile.setShowPhotoCapture(true)}
      />
      <PhotoCapture
        visible={profile.showPhotoCapture}
        onClose={() => profile.setShowPhotoCapture(false)}
        onCaptured={profile.handlePhotoCapture}
      />

      <Animated.View entering={FadeInDown.delay(100).duration(350)}>
        <ProfileInfoSection profile={profile} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(350)}>
        <SecuritySection profile={profile} />
      </Animated.View>

      {/* Sign out */}
      <Animated.View entering={FadeInDown.delay(260).duration(350)} style={styles.signOutSection}>
        <PressableScale
          style={styles.signOutRow}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            profile.handleSignOut();
          }}
        >
          <View style={styles.signOutIconWrap}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <Text style={styles.signOutText}>Sign Out</Text>
        </PressableScale>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>ShiftWork Mobile · v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  signOutSection: { paddingHorizontal: spacing.lg, paddingTop: 16 },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,59,48,0.07)',
    borderRadius: radius.xl, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.14)',
  },
  signOutIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  footer: { paddingVertical: 28, alignItems: 'center' },
  footerText: { fontSize: 12, color: colors.muted },
});

