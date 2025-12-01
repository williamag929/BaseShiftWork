import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { shiftEventService, dbService } from '@/services';
import { getCurrentLocation } from '@/utils';
import { useAuthStore } from '@/store/authStore';
import type { ShiftEventDto } from '@/types/api';
import PhotoCapture from '@/components/PhotoCapture';
import { uploadService } from '@/services/upload.service';
import { getActiveClockInAt, saveActiveClockInAt, clearActiveClockInAt } from '@/utils';

export default function ClockScreen() {
  const { companyId, personId } = useAuthStore();
  const [events, setEvents] = useState<ShiftEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeClockInAt, setActiveClockInAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

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
          <Text style={styles.personValue}>{personId ? `#${personId}` : 'Not signed in'}</Text>
        </View>
      </View>

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
          <Ionicons name="camera" size={20} color="#4A90E2" />
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
                <Ionicons name={isClockedIn ? 'log-out' : 'log-in'} size={64} color="#fff" />
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
          <Text style={styles.infoText}>
            Tap the button to {isClockedIn ? 'clock out' : 'clock in'}. Your location and device info will be included.
          </Text>
        )}
      </View>

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
    backgroundColor: '#f5f5f5',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
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
    color: '#333',
  },
  textIn: { color: '#2E7D32' },
  textOut: { color: '#EF6C00' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  personLabel: {
    fontSize: 14,
    color: '#333',
  },
  personValue: { fontSize: 16, color: '#333', fontWeight: '600' },
  clockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  photoBtnText: { color: '#4A90E2', fontWeight: '600' },
  previewRow: { alignItems: 'center', marginBottom: 12 },
  preview: { width: 120, height: 120, borderRadius: 8, marginBottom: 6 },
  removePhoto: { color: '#E74C3C', textDecorationLine: 'underline' },
  clockButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  clockInBtn: { backgroundColor: '#4A90E2' },
  clockOutBtn: { backgroundColor: '#E74C3C' },
  iconContainer: {
    marginBottom: 8,
  },
  clockButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    padding: 32,
    alignItems: 'center',
  },
  elapsedText: { marginTop: 8, color: '#2E7D32', fontWeight: '600' },
  infoText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
  },
});
