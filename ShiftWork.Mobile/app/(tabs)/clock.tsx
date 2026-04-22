import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, radius } from '@/styles/tokens';
import { useClockAction } from '@/hooks/useClockAction';
import { useAuthStore } from '@/store/authStore';
import { ClockButton } from '@/components/screens/clock/ClockButton';
import { ElapsedTimer } from '@/components/screens/clock/ElapsedTimer';
import { SafetyQuestionnaire } from '@/components/screens/clock/SafetyQuestionnaire';
import PhotoCapture from '@/components/PhotoCapture';

const INFO_ITEMS = [
  { icon: 'location' as const, text: 'Location captured' },
  { icon: 'camera' as const, text: 'Photo optional' },
  { icon: 'phone-portrait' as const, text: 'Device recorded' },
];

export default function ClockScreen() {
  const { name } = useAuthStore();
  const insets = useSafeAreaInsets();
  const {
    loading,
    initializing,
    error,
    photoUri,
    cameraOpen,
    elapsedSeconds,
    todayShift,
    safetyQuestions,
    shiftLocationName,
    isClockedIn,
    setPhotoUri,
    setCameraOpen,
    handleClock,
  } = useClockAction();

  const firstName = name ? name.split(' ')[0] : 'there';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Hero header */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <Animated.View entering={FadeIn.duration(350)}>
          <Text style={styles.heroGreeting}>{isClockedIn ? 'You are on the clock' : 'Ready to start?'}</Text>
          <Text style={styles.heroName}>{firstName}</Text>
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(100).duration(350)}
          style={[styles.statusPill, isClockedIn ? styles.pillIn : styles.pillOut]}
        >
          <View style={[styles.pillDot, { backgroundColor: isClockedIn ? colors.success : colors.muted }]} />
          <Text style={[styles.pillText, { color: isClockedIn ? colors.success : colors.muted }]}>
            {isClockedIn ? 'On Clock' : 'Off Clock'}
          </Text>
        </Animated.View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Elapsed timer (when clocked in) */}
        {isClockedIn && (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.timerCard}>
            <ElapsedTimer seconds={elapsedSeconds} />
          </Animated.View>
        )}

        {/* Safety questionnaire (when shift scheduled & not clocked in) */}
        {!!todayShift && !isClockedIn && (
          <SafetyQuestionnaire shift={todayShift} questions={safetyQuestions} locationName={shiftLocationName} />
        )}

        {/* Clock button */}
        <View style={styles.clockBtnArea}>
          <ClockButton
            isClockedIn={isClockedIn}
            loading={loading}
            onPress={handleClock}
            photoUri={photoUri}
            onPhotoPress={() => setCameraOpen(true)}
            onRemovePhoto={() => setPhotoUri(null)}
          />
        </View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Info card */}
        {!initializing && !error && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.infoCard}>
            <Text style={styles.infoTitle}>
              {isClockedIn ? 'Clock out when done' : `Clock in to start your shift`}
            </Text>
            <View style={styles.infoRows}>
              {INFO_ITEMS.map((item) => (
                <View key={item.text} style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name={item.icon} size={15} color={colors.primary} />
                  </View>
                  <Text style={styles.infoRowText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <PhotoCapture
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={(uri) => setPhotoUri(uri)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingBottom: 28,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  heroGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  heroName: { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    marginBottom: 4,
  },
  pillIn:  { backgroundColor: 'rgba(52,199,89,0.18)' },
  pillOut: { backgroundColor: 'rgba(255,255,255,0.12)' },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '600' },

  // Timer card
  timerCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg, marginTop: 16,
    borderRadius: radius.xl, paddingVertical: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },

  // Clock button area
  clockBtnArea: { marginTop: 8 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,59,48,0.10)', borderRadius: radius.lg,
    marginHorizontal: spacing.lg, marginTop: 12, padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger },

  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg, marginTop: 16,
    borderRadius: radius.xl, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  infoTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 12 },
  infoRows: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  infoRowText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
});
