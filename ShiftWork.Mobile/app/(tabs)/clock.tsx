import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { shiftEventService, dbService } from '@/services';
import { getCurrentLocation } from '@/utils';
import { useAuthStore } from '@/store/authStore';
import type { ShiftEventDto } from '@/types/api';
import PhotoCapture from '@/components/PhotoCapture';
import { peopleService } from '@/services/people.service';
import { uploadService } from '@/services/upload.service';
import { scheduleService } from '@/services/schedule.service';
import { kioskService } from '@/services/kiosk.service';
import { locationService } from '@/services/location.service';
import { getActiveClockInAt, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';
import { formatScheduleTime } from '@/utils/date.utils';
import { Card } from '@/components/ui';
import { colors } from '@/styles/theme';
import type { KioskQuestionDto, ScheduleShiftDto } from '@/types/api';

export default function ClockScreen() {
  const { companyId, personId, name } = useAuthStore();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  const [events, setEvents] = useState<ShiftEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [todayShift, setTodayShift] = useState<ScheduleShiftDto | null>(null);
  const [safetyQuestions, setSafetyQuestions] = useState<KioskQuestionDto[]>([]);
  const [shiftLocationName, setShiftLocationName] = useState<string | null>(null);

  const lastEvent = useMemo(() => (events.length ? events[0] : null), [events]);
  const isClockedIn = lastEvent?.eventType === 'clockin' || !!activeClockInAt;

  const loadEvents = async () => {
    if (!companyId || !personId) return;
    try {
      const data = await shiftEventService.getPersonShiftEvents(companyId, personId);
      // Assuming API returns events ordered desc; if not, sort by date desc
      const sorted = [...data].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
      );
      setEvents(sorted);
      // derive active clock-in from latest event
      const latest = sorted[0];
      if (latest?.eventType === 'clockin') {
        setActiveClockInAt(new Date(latest.eventDate));
        await saveActiveClockInAt(new Date(latest.eventDate).toISOString());
      } else {
        setActiveClockInAt(null);
        await clearActiveClockInAt();
      }
    } catch (e: any) {
      // Fallback to cached events from SQLite when offline
      try {
        const cached = await dbService.getRecentEvents(personId, 10);
        const sorted = [...cached].sort(
          (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        );
        setEvents(sorted);
        const latest = sorted[0];
        if (latest?.eventType === 'clockin') {
          setActiveClockInAt(new Date(latest.eventDate));
        } else {
          // If no cached event, try persisted clock-in timestamp
          const saved = await getActiveClockInAt();
          setActiveClockInAt(saved ? new Date(saved) : null);
        }
      } catch (e2: any) {
        setError(e?.message || 'Failed to load events');
        // also try persisted timestamp as last resort
        const saved = await getActiveClockInAt();
        setActiveClockInAt(saved ? new Date(saved) : null);
      }
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, personId]);

  // Hydrate person name if missing
  useEffect(() => {
    (async () => {
      try {
        if (companyId && personId && !name) {
          const person = await peopleService.getPersonById(companyId, personId);
          if (person) {
            setPersonProfile({
              name: person.name ?? null,
              email: person.email ?? null,
            });
          }
        }
      } catch {}
    })();
  }, [companyId, personId, name, setPersonProfile]);

  // Fetch today's shift and kiosk safety questions
  useEffect(() => {
    if (!companyId || !personId) return;
    (async () => {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const shifts = await scheduleService.getPersonShifts(
          companyId,
          personId,
          todayStart.toISOString(),
          todayEnd.toISOString()
        );
        const shift = shifts?.[0] ?? null;
        setTodayShift(shift);
        if (shift?.locationId) {
          try {
            const loc = await locationService.getLocationById(companyId, shift.locationId);
            setShiftLocationName(loc?.name ?? null);
          } catch {
            setShiftLocationName(null);
          }
        }
      } catch {
        setTodayShift(null);
      }
      try {
        const questions = await kioskService.getKioskQuestions(companyId);
        setSafetyQuestions(questions.filter((q) => q.isActive));
      } catch {
        setSafetyQuestions([]);
      }
    })();
  }, [companyId, personId]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    const start = activeClockInAt || (lastEvent?.eventType === 'clockin' ? new Date(lastEvent.eventDate) : null);
    if (!isClockedIn || !start) {
      setElapsedSeconds(0);
      return;
    }
    const update = () => {
      const ms = Date.now() - start.getTime();
      setElapsedSeconds(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isClockedIn, activeClockInAt, lastEvent?.eventDate]);

  const fmtHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const handleClock = async () => {
    if (!companyId) {
      Alert.alert('Missing Company', 'Company ID is not set.');
      return;
    }
    if (!personId) {
      Alert.alert('Not Signed In', 'Please sign in to clock in/out.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const geoLocation = await getCurrentLocation();
      const kioskDevice = Device.modelName || 'mobile-device';
      let uploadedUrl: string | undefined = undefined;
      if (photoUri) {
        uploadedUrl = await uploadService.uploadPhoto(photoUri);
      }

      const result = isClockedIn
        ? await shiftEventService.clockOut(
            companyId,
            personId,
            geoLocation || undefined,
            uploadedUrl,
            kioskDevice
          )
        : await shiftEventService.clockIn(
            companyId,
            personId,
            geoLocation || undefined,
            uploadedUrl,
            kioskDevice
          );

      // Prepend to events
      setEvents((prev) => [result, ...prev]);
      // Update active clock-in persistence
      if (result.eventType === 'clockin') {
        setActiveClockInAt(new Date(result.eventDate));
        await saveActiveClockInAt(new Date(result.eventDate).toISOString());
      } else if (result.eventType === 'clockout') {
        setActiveClockInAt(null);
        await clearActiveClockInAt();
      }
      Alert.alert('Success', isClockedIn ? 'Clocked out successfully' : 'Clocked in successfully');
    } catch (e: any) {
      const msg = e?.message || 'Clock action failed';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clock In/Out</Text>
        <Text style={styles.headerSubtitle}>Capture time, location, and optional photo.</Text>
      </View>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Current Status</Text>
        <View style={[styles.statusBadge, isClockedIn ? styles.badgeIn : styles.badgeOut]}>
          <Text style={[styles.statusText, isClockedIn ? styles.textIn : styles.textOut]}>
            {isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </Text>
        </View>
        {isClockedIn && (
          <Text style={styles.elapsedText}>Time on clock: {fmtHMS(elapsedSeconds)}</Text>
        )}
        {/* Person is sourced from previous auth; no manual input */}
        <View style={styles.personRow}>
          <Text style={styles.personLabel}>Person</Text>
          <Text style={styles.personValue}>{name || 'Not signed in'}</Text>
        </View>
      </View>

      <Card style={styles.stepCard}>
        <View style={styles.stepRow}>
          <Ionicons name="location" size={18} color={colors.primary} />
          <Text style={styles.stepText}>Location captured</Text>
        </View>
        <View style={styles.stepRow}>
          <Ionicons name="camera" size={18} color={colors.primary} />
          <Text style={styles.stepText}>Photo optional</Text>
        </View>
        <View style={styles.stepRow}>
          <Ionicons name="phone-portrait" size={18} color={colors.primary} />
          <Text style={styles.stepText}>Device recorded</Text>
        </View>
      </Card>

      {/* Pre-Task Safety Card — shown when today's shift exists and not clocked in */}
      {!!todayShift && !isClockedIn && (
        <Card style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#E67E22" />
            <Text style={styles.safetyTitle}>Pre-Task Safety Check</Text>
          </View>
          <View style={styles.safetyShiftRow}>
            <Ionicons name="time-outline" size={15} color={colors.primary} />
            <Text style={styles.safetyShiftText}>
              Today's Shift: {formatScheduleTime(todayShift.startDate)} — {formatScheduleTime(todayShift.endDate)}
            </Text>
          </View>
          {!!shiftLocationName && (
            <View style={styles.safetyShiftRow}>
              <Ionicons name="location-outline" size={15} color={colors.primary} />
              <Text style={styles.safetyShiftText}>{shiftLocationName}</Text>
            </View>
          )}
          {safetyQuestions.length > 0 && (
            <>
              <Text style={styles.safetySubtitle}>Review before starting your shift:</Text>
              {safetyQuestions.map((q) => (
                <View key={q.questionId} style={styles.safetyItemRow}>
                  <Ionicons name="checkbox-outline" size={16} color="#27AE60" />
                  <Text style={styles.safetyItemText}>{q.questionText}</Text>
                </View>
              ))}
            </>
          )}
          {safetyQuestions.length === 0 && (
            <Text style={styles.safetyNoItems}>No pending safety items. You’re good to go!</Text>
          )}
        </Card>
      )}

      <View style={styles.clockContainer}>
        {!!photoUri && (
          <View style={styles.previewRow}>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <TouchableOpacity onPress={() => setPhotoUri(null)}>
              <Text style={styles.removePhoto}>Remove photo</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.photoBtn} onPress={() => setCameraOpen(true)} disabled={loading}>
          <Ionicons name="camera" size={20} color={colors.primary} />
          <Text style={styles.photoBtnText}>{photoUri ? 'Retake Photo' : 'Add Photo (optional)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.clockButton, isClockedIn ? styles.clockOutBtn : styles.clockInBtn]}
          onPress={handleClock}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name={isClockedIn ? 'log-out' : 'log-in'} size={48} color="#fff" />
              </View>
              <Text style={styles.clockButtonText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        {initializing && <ActivityIndicator />}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!initializing && !error && (
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Ready to {isClockedIn ? 'clock out' : 'clock in'}?</Text>
            <Text style={styles.infoText}>
              Tap the button to {isClockedIn ? 'clock out' : 'clock in'}. Your location and device info will be included.
            </Text>
          </Card>
        )}
      </View>

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  statusContainer: {
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeIn: { backgroundColor: '#E8F5E9' },
  badgeOut: { backgroundColor: '#FFF3E0' },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  textIn: { color: colors.success },
  textOut: { color: colors.warning },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  personLabel: {
    fontSize: 14,
    color: colors.text,
  },
  personValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 32,
  },
  clockContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  stepCard: {
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepText: {
    fontSize: 13,
    color: '#4A4A4A',
    fontWeight: '600',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  photoBtnText: { color: colors.primary, fontWeight: '600' },
  previewRow: { alignItems: 'center', marginBottom: 10 },
  preview: { width: 96, height: 96, borderRadius: 8, marginBottom: 6 },
  removePhoto: { color: colors.danger, textDecorationLine: 'underline' },
  clockButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  clockInBtn: { backgroundColor: colors.primary },
  clockOutBtn: { backgroundColor: colors.danger },
  iconContainer: {
    marginBottom: 8,
  },
  clockButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  infoCard: {
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  elapsedText: { marginTop: 8, color: colors.success, fontWeight: '600' },
  infoText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
  },
  safetyCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  safetyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E67E22',
  },
  safetyShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  safetyShiftText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  safetySubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
    marginBottom: 6,
  },
  safetyItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  safetyItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  safetyNoItems: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
