import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { dailyReportService, DailyReport, ReportMedia } from '@/services/daily-report.service';
import { locationService } from '@/services/location.service';
import type { LocationDto } from '@/types/api';
import { colors, spacing, radius } from '@/styles/tokens';

const today = new Date().toISOString().split('T')[0];

const STATUS_COLOR: Record<string, string> = {
  Draft:     '#8E8E93',
  Submitted: '#007AFF',
  Approved:  '#34C759',
};

export default function DailyReportScreen() {
  const insets = useSafeAreaInsets();
  const { companyId } = useAuthStore();

  const [locations, setLocations]       = useState<LocationDto[]>([]);
  const [locationId, setLocationId]     = useState<number | null>(null);
  const [report, setReport]             = useState<DailyReport | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [notes, setNotes]               = useState('');
  const [uploading, setUploading]       = useState(false);
  const [noAccess, setNoAccess]         = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);

  // Note attachment modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText]           = useState('');
  const [savingNote, setSavingNote]       = useState(false);

  useEffect(() => {
    locationService.getLocations(companyId)
      .then(locs => {
        const active = locs.filter(l => l.isActive);
        setLocations(active);
        if (active.length > 0) setLocationId(active[0].locationId);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  const loadReport = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setNoAccess(false);
    setLoadError(null);
    try {
      const r = await dailyReportService.getReport(companyId, locationId, today);
      setReport(r);
      setNotes(r.notes ?? '');
    } catch (err: any) {
      if (err?.statusCode === 403) setNoAccess(true);
      else setLoadError('Could not load the daily report. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [companyId, locationId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const save = async (newStatus?: string) => {
    if (!report || !locationId) return;
    setSaving(true);
    try {
      const updated = await dailyReportService.updateReport(
        companyId, locationId, report.reportId, notes, newStatus ?? report.status
      );
      setReport(updated);
      if (newStatus) Alert.alert('Success', `Report ${newStatus.toLowerCase()}.`);
    } catch {
      Alert.alert('Error', 'Could not save report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert('Add Attachment', undefined, [
      { text: 'Take Photo',            onPress: () => pickPhoto('camera') },
      { text: 'Choose from Library',   onPress: () => pickPhoto('library') },
      { text: 'Add Note',              onPress: () => { setNoteText(''); setNoteModalOpen(true); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    if (!report || !locationId) return;

    const permResult = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert(
        'Permission Required',
        source === 'camera'
          ? 'Camera access is required to take photos.'
          : 'Photo library access is required to pick photos.'
      );
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.75,
          allowsMultipleSelection: false,
        });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
    const mimeType = asset.mimeType ?? 'image/jpeg';

    setUploading(true);
    try {
      const media = await dailyReportService.addMedia(
        companyId, locationId, report.reportId,
        { uri: asset.uri, name: fileName, type: mimeType },
        'Photo'
      );
      setReport(prev => prev ? { ...prev, media: [...prev.media, media] } : prev);
    } catch {
      Alert.alert('Error', 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const saveNote = async () => {
    if (!noteText.trim() || !report || !locationId) return;
    setSavingNote(true);
    try {
      const media = await dailyReportService.addNoteText(
        companyId, locationId, report.reportId, noteText.trim()
      );
      setReport(prev => prev ? { ...prev, media: [...prev.media, media] } : prev);
      setNoteModalOpen(false);
      setNoteText('');
    } catch {
      Alert.alert('Error', 'Could not save note. Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  const photos = report?.media.filter(m => m.mediaType === 'Photo') ?? [];
  const noteAttachments = report?.media.filter(m => m.mediaType === 'Note') ?? [];
  const weather = report?.weatherData as any;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Report</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {/* Location picker */}
      {locations.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.locationScroll}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, flexDirection: 'row' }}
        >
          {locations.map(loc => (
            <TouchableOpacity
              key={loc.locationId}
              style={[styles.locationChip, loc.locationId === locationId && styles.locationChipActive]}
              onPress={() => setLocationId(loc.locationId)}
            >
              <Text style={[styles.locationChipText, loc.locationId === locationId && styles.locationChipTextActive]}>
                {loc.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {noAccess ? (
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>You don't have access to daily reports.</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorCard}>
          <Ionicons name="wifi-outline" size={28} color="#FF3B30" />
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadReport}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : !report ? (
        <View style={styles.centered}>
          <Ionicons name="clipboard-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>No report found for this location.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 100 }}>
          {/* Status */}
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[report.status] + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[report.status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLOR[report.status] }]}>{report.status}</Text>
          </View>

          {/* Weather */}
          {weather && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>WEATHER</Text>
              <View style={styles.weatherRow}>
                <Text style={styles.weatherTemp}>{Math.round(weather.temperature ?? 0)}°F</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weatherDesc}>{weather.description}</Text>
                  <Text style={styles.weatherMeta}>
                    Feels {Math.round(weather.feelsLike ?? 0)}° · Wind {Math.round(weather.windSpeed ?? 0)} mph · {weather.humidity}% humidity
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Attendance */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>ATTENDANCE</Text>
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{report.totalEmployees}</Text>
                <Text style={styles.statLabel}>Employees</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{report.totalHours.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Hours</Text>
              </View>
            </View>
          </View>

          {/* Attachments */}
          <View style={styles.card}>
            <View style={styles.cardLabelRow}>
              <Text style={styles.cardLabel}>ATTACHMENTS</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={showAttachmentOptions}
                disabled={uploading || report.status === 'Approved'}
              >
                {uploading
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <>
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={styles.addBtnText}>Add</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

            {/* Photos */}
            {photos.length > 0 && (
              <>
                <Text style={styles.attachSubLabel}>Photos ({photos.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {photos.map(m => (
                      <Image key={m.mediaId} source={{ uri: m.mediaUrl }} style={styles.photoThumb} />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Note attachments */}
            {noteAttachments.length > 0 && (
              <>
                <Text style={styles.attachSubLabel}>Notes ({noteAttachments.length})</Text>
                <View style={{ gap: 8 }}>
                  {noteAttachments.map(m => (
                    <View key={m.mediaId} style={styles.noteCard}>
                      <Ionicons name="document-text-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                      <Text style={styles.noteCardText} numberOfLines={3}>{m.caption ?? '(no text)'}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {photos.length === 0 && noteAttachments.length === 0 && (
              <Text style={styles.emptyAttach}>No attachments yet. Tap Add to include photos or notes.</Text>
            )}
          </View>

          {/* Notes */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SHIFT NOTES</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Add shift notes, incidents, observations..."
              placeholderTextColor={colors.muted}
              textAlignVertical="top"
              editable={report.status !== 'Approved'}
            />
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            {report.status !== 'Approved' && (
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => save()} disabled={saving}>
                <Text style={styles.btnSecondaryText}>{saving ? 'Saving…' : 'Save Draft'}</Text>
              </TouchableOpacity>
            )}
            {report.status === 'Draft' && (
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => save('Submitted')} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Submit Report</Text>
                }
              </TouchableOpacity>
            )}
            {report.status === 'Submitted' && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => save('Approved')} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Approve</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Add Note modal */}
      <Modal visible={noteModalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.noteModal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.noteModalHeader}>
            <TouchableOpacity onPress={() => setNoteModalOpen(false)}>
              <Text style={styles.noteModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.noteModalTitle}>Add Note</Text>
            <TouchableOpacity onPress={saveNote} disabled={!noteText.trim() || savingNote}>
              {savingNote
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Text style={[styles.noteModalSave, !noteText.trim() && styles.noteModalSaveDisabled]}>Save</Text>
              }
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.noteModalInput}
            value={noteText}
            onChangeText={setNoteText}
            multiline
            autoFocus
            placeholder="Enter note text..."
            placeholderTextColor={colors.muted}
            textAlignVertical="top"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: colors.background },
  centered:               { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorCard:              { margin: spacing.md, padding: spacing.lg, backgroundColor: '#FFF1F0', borderRadius: 12, alignItems: 'center', gap: 10 },
  errorText:              { fontSize: 14, color: '#FF3B30', textAlign: 'center', lineHeight: 20 },
  retryBtn:               { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B30' },
  retryText:              { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  header:                 { paddingHorizontal: spacing.md, paddingBottom: 8 },
  headerTitle:            { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  headerDate:             { fontSize: 14, color: colors.muted, marginTop: 2 },
  locationScroll:         { maxHeight: 44, marginBottom: 8 },
  locationChip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  locationChipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  locationChipText:       { fontSize: 13, fontWeight: '500', color: colors.text },
  locationChipTextActive: { color: '#fff' },
  emptyText:              { fontSize: 15, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.xxl },
  statusBadge:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, alignSelf: 'flex-start', marginBottom: 12 },
  statusDot:              { width: 7, height: 7, borderRadius: 4 },
  statusText:             { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  card:                   { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12 },
  cardLabel:              { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.7, marginBottom: 8 },
  cardLabelRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addBtn:                 { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.primaryLight },
  addBtnText:             { fontSize: 13, fontWeight: '600', color: colors.primary },
  attachSubLabel:         { fontSize: 11, color: colors.muted, fontWeight: '500', marginBottom: 6 },
  photoThumb:             { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden' },
  noteCard:               { flexDirection: 'row', gap: 8, backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm },
  noteCardText:           { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  emptyAttach:            { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.md, lineHeight: 19 },
  weatherRow:             { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weatherTemp:            { fontSize: 40, fontWeight: '200', color: colors.text, letterSpacing: -1 },
  weatherDesc:            { fontSize: 15, fontWeight: '500', color: colors.text, textTransform: 'capitalize' },
  weatherMeta:            { fontSize: 12, color: colors.muted, marginTop: 2 },
  statRow:                { flexDirection: 'row', alignItems: 'center' },
  statBox:                { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statValue:              { fontSize: 34, fontWeight: '300', color: colors.text, letterSpacing: -1 },
  statLabel:              { fontSize: 12, color: colors.muted, marginTop: 2 },
  statDivider:            { width: 1, height: 48, backgroundColor: colors.border },
  notesInput:             { minHeight: 100, fontSize: 15, color: colors.text, lineHeight: 22, paddingTop: 0 },
  actionRow:              { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  btn:                    { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimary:             { backgroundColor: colors.primary },
  btnSecondary:           { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnPrimaryText:         { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondaryText:       { color: colors.text, fontSize: 15, fontWeight: '500' },
  noteModal:              { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  noteModalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border, marginBottom: spacing.md },
  noteModalTitle:         { fontSize: 17, fontWeight: '600', color: colors.text },
  noteModalCancel:        { fontSize: 17, color: colors.primary },
  noteModalSave:          { fontSize: 17, fontWeight: '600', color: colors.primary },
  noteModalSaveDisabled:  { color: colors.muted },
  noteModalInput:         { flex: 1, fontSize: 16, color: colors.text, lineHeight: 24 },
});
