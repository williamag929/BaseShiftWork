import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { peopleService } from '@/services/people.service';
import { useScheduleData } from '@/hooks/useScheduleData';
import { formatDate, formatTime, getEndOfDay, getEndOfMonth, getEndOfWeek, getStartOfDay, getStartOfMonth, getStartOfWeek } from '@/utils/date.utils';
import { colors } from '@/styles/theme';
import { Card, EmptyState, SectionHeader } from '@/components/ui';

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
        <SectionHeader title={`Shifts (${formatDate(from)} - ${formatDate(to)})`} />
        {loading && <ActivityIndicator />}
        {!loading && shifts.length === 0 && (
          <EmptyState title="No shifts" message="No shifts in this range." icon="calendar-clear-outline" />
        )}
        {!loading && shifts.map((s) => (
          <Card key={s.scheduleShiftId} style={styles.card}>
            <Text style={styles.cardTitle}>{formatDate(s.startDate)}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(s.startDate)} - {formatTime(s.endDate)}</Text>
            <Text style={styles.cardMeta}>Shift #{s.scheduleShiftId} • Status: {s.status}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Clocked Events" />
        {loading && <ActivityIndicator />}
        {!loading && events.length === 0 && (
          <EmptyState title="No events" message="No events in this range." icon="pulse-outline" />
        )}
        {!loading && events.map((e) => (
          <Card key={e.eventLogId} style={styles.card}>
            <Text style={styles.cardText}>{e.eventType.replace('_', ' ')}</Text>
            <Text style={styles.cardMeta}>{formatDate(e.eventDate)} {formatTime(e.eventDate)}</Text>
          </Card>
        ))}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  offline: { color: colors.warning, marginTop: 4 },
  modeSwitcher: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: '#E8F1FB' },
  modeText: { color: colors.text, fontWeight: '600' },
  modeTextActive: { color: colors.primary },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  card: { backgroundColor: colors.surface, padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  cardText: { fontSize: 14, color: colors.text },
  error: { color: colors.danger, marginTop: 8 },
  rangeBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rangeText: { color: colors.text, fontWeight: '600' },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.primary, borderRadius: 8 },
  rangeBtnText: { color: colors.primary, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: colors.surface, width: '85%', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  modalRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modalRowJustify: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  modalChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  modalChipActive: { borderColor: colors.primary, backgroundColor: '#E8F1FB' },
  modalChipText: { color: colors.text, fontWeight: '600' },
  modalChipTextActive: { color: colors.primary },
  navBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background },
  navBtnText: { color: colors.text, fontWeight: '600' },
  selDate: { color: colors.text, fontWeight: '700' },
  modalClose: { marginTop: 8, alignSelf: 'flex-end' },
  modalCloseText: { color: colors.primary, fontWeight: '700' },
});
