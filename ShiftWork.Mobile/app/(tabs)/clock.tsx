import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useClockAction } from '@/hooks/useClockAction';
import { useAuthStore } from '@/store/authStore';
import { ClockButton } from '@/components/screens/clock/ClockButton';
import { ElapsedTimer } from '@/components/screens/clock/ElapsedTimer';
import { SafetyQuestionnaire } from '@/components/screens/clock/SafetyQuestionnaire';
import PhotoCapture from '@/components/PhotoCapture';

const STEP_ITEMS = [
  { icon: 'location' as const, text: 'Location captured' },
  { icon: 'camera' as const, text: 'Photo optional' },
  { icon: 'phone-portrait' as const, text: 'Device recorded' },
];

export default function ClockScreen() {
  const { name } = useAuthStore();
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


  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <View style={[styles.statusBadge, isClockedIn ? styles.badgeIn : styles.badgeOut]}>
            <Text style={[styles.statusText, isClockedIn ? styles.textIn : styles.textOut]}>
              {isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </Text>
          </View>
          {isClockedIn && <ElapsedTimer seconds={elapsedSeconds} />}
          <View style={styles.personRow}>
            <Text style={styles.personLabel}>Person</Text>
            <Text style={styles.personValue}>{name || 'Not signed in'}</Text>
          </View>
        </View>

        {!!todayShift && !isClockedIn && (
          <SafetyQuestionnaire shift={todayShift} questions={safetyQuestions} locationName={shiftLocationName} />
        )}
        <ClockButton
          isClockedIn={isClockedIn}
          loading={loading}
          onPress={handleClock}
          photoUri={photoUri}
          onPhotoPress={() => setCameraOpen(true)}
          onRemovePhoto={() => setPhotoUri(null)}
        />

        <View style={styles.infoContainer}>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!initializing && !error && (
            <Card style={{ alignItems: 'center' }}>
              <Text style={styles.infoTitle}>Ready to {isClockedIn ? 'clock out' : 'clock in'}?</Text>
              <Text style={styles.infoText}>Your location and device info will be included.</Text>
            </Card>
          )}
        </View>

        <Card style={styles.stepCard}>
          {STEP_ITEMS.map((s) => (
            <View key={s.text} style={styles.stepRow}>
              <Ionicons name={s.icon} size={18} color={colors.primary} />
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </Card>

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
  header: { backgroundColor: colors.primary, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerSubtitle: { marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  statusContainer: { backgroundColor: colors.surface, padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  statusLabel: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  statusBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  badgeIn: { backgroundColor: '#E8F5E9' },
  badgeOut: { backgroundColor: '#FFF3E0' },
  statusText: { fontSize: 16, fontWeight: '600', color: colors.text },
  textIn: { color: colors.success },
  textOut: { color: colors.warning },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  personLabel: { fontSize: 14, color: colors.text },
  personValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  stepCard: { marginHorizontal: spacing.lg, marginTop: 12, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { fontSize: 13, color: '#4A4A4A', fontWeight: '600' },
  infoContainer: { paddingHorizontal: spacing.xl, paddingVertical: 16, alignItems: 'center' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  infoText: { fontSize: 16, color: colors.text, textAlign: 'center', marginBottom: 8 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
