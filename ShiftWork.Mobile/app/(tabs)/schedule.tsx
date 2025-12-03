import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { peopleService } from '@/services/people.service';
import { useScheduleData } from '@/hooks/useScheduleData';
import { formatDate, formatTime, getEndOfDay, getEndOfMonth, getEndOfWeek, getStartOfDay, getStartOfMonth, getStartOfWeek } from '@/utils/date.utils';

type ViewMode = 'day' | 'week' | 'month';

export default function ScheduleScreen() {
  const { companyId, personId, personFirstName, personLastName } = useAuthStore();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mode, setMode] = useState<ViewMode>('week');
  const [pickerOpen, setPickerOpen] = useState(false);

  const { from, to } = useMemo(() => {
    if (mode === 'day') return { from: getStartOfDay(selectedDate), to: getEndOfDay(selectedDate) };
    if (mode === 'month') return { from: getStartOfMonth(selectedDate), to: getEndOfMonth(selectedDate) };
    return { from: getStartOfWeek(selectedDate), to: getEndOfWeek(selectedDate) };
  }, [selectedDate, mode]);

  const { isOnline, loading, error, shifts, events } = useScheduleData(companyId, personId, from, to);

  // Hydrate person name if missing
  useEffect(() => {
    (async () => {
      try {
        if (companyId && personId && (!personFirstName || !personLastName)) {
          const person = await peopleService.getPersonById(companyId, personId);
          if (person) {
            setPersonProfile({
              firstName: person.firstName ?? null,
              lastName: person.lastName ?? null,
              email: person.email ?? null,
            });
          }
        }
      } catch {}
    })();
  }, [companyId, personId]);

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate);
    if (mode === 'day') d.setDate(d.getDate() + delta);
    else if (mode === 'week') d.setDate(d.getDate() + 7 * delta);
    else d.setMonth(d.getMonth() + delta);
    setSelectedDate(d);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Popup selection instead of inline calendar */}
      <View style={styles.rangeBar}>
        <Text style={styles.rangeText}>{formatDate(from)} - {formatDate(to)}</Text>
        <TouchableOpacity style={styles.rangeBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.rangeBtnText}>Change Range</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Range</Text>
            <View style={styles.modalRow}>
              {(['day','week','month'] as ViewMode[]).map((m) => (
                <TouchableOpacity key={m} style={[styles.modalChip, mode===m && styles.modalChipActive]} onPress={() => setMode(m)}>
                  <Text style={[styles.modalChipText, mode===m && styles.modalChipTextActive]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalRowJustify}>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftDate(-1)}>
                <Text style={styles.navBtnText}>◀ Prev</Text>
              </TouchableOpacity>
              <Text style={styles.selDate}>{formatDate(selectedDate)}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftDate(1)}>
                <Text style={styles.navBtnText}>Next ▶</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        {!isOnline && <Text style={styles.offline}>Offline mode • showing cached data</Text>}
      </View>

      <View style={styles.modeSwitcher}>
        {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
          <TouchableOpacity key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} onPress={() => setMode(m)}>
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shifts ({formatDate(from)} - {formatDate(to)})</Text>
        {loading && <ActivityIndicator />}
        {!loading && shifts.length === 0 && (
          <View style={styles.card}><Text style={styles.cardText}>No shifts in this range</Text></View>
        )}
        {!loading && shifts.map((s) => (
          <View key={s.scheduleShiftId} style={styles.card}>
            <Text style={styles.cardTitle}>{formatDate(s.startDate)}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(s.startDate)} - {formatTime(s.endDate)}</Text>
            <Text style={styles.cardMeta}>Shift #{s.scheduleShiftId} • Status: {s.status}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clocked Events</Text>
        {loading && <ActivityIndicator />}
        {!loading && events.length === 0 && (
          <View style={styles.card}><Text style={styles.cardText}>No events in this range</Text></View>
        )}
        {!loading && events.map((e) => (
          <View key={e.eventLogId} style={styles.card}>
            <Text style={styles.cardText}>{e.eventType.replace('_', ' ')}</Text>
            <Text style={styles.cardMeta}>{formatDate(e.eventDate)} {formatTime(e.eventDate)}</Text>
          </View>
        ))}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: '700', color: '#333' },
  offline: { color: '#E67E22', marginTop: 4 },
  modeSwitcher: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
  modeBtnActive: { borderColor: '#4A90E2', backgroundColor: '#E8F1FB' },
  modeText: { color: '#333', fontWeight: '600' },
  modeTextActive: { color: '#4A90E2' },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  cardSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#999', marginTop: 6 },
  cardText: { fontSize: 14, color: '#333' },
  error: { color: '#E74C3C', marginTop: 8 },
  rangeBar: { backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rangeText: { color: '#333', fontWeight: '600' },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#4A90E2', borderRadius: 8 },
  rangeBtnText: { color: '#4A90E2', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', width: '85%', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12 },
  modalRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modalRowJustify: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  modalChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  modalChipActive: { borderColor: '#4A90E2', backgroundColor: '#E8F1FB' },
  modalChipText: { color: '#333', fontWeight: '600' },
  modalChipTextActive: { color: '#4A90E2' },
  navBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f5f5f5' },
  navBtnText: { color: '#333', fontWeight: '600' },
  selDate: { color: '#333', fontWeight: '700' },
  modalClose: { marginTop: 8, alignSelf: 'flex-end' },
  modalCloseText: { color: '#4A90E2', fontWeight: '700' },
});
