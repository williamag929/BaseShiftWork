import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { peopleService } from '@/services/people.service';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useCompanyTimeZone } from '@/hooks/queries';
import {
  formatDate, formatScheduleTime, formatTime,
  getEndOfDay, getEndOfMonth, getEndOfWeek,
  getStartOfDay, getStartOfMonth, getStartOfWeek,
} from '@/utils/date.utils';
import { colors, spacing, radius } from '@/styles/tokens';
import { EmptyState, SectionHeader } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ShiftDetailModal } from '@/components/screens/schedule/ShiftDetailModal';
import type { ScheduleShiftDto } from '@/types/api';

type ViewMode = 'day' | 'week' | 'month';

const MODE_LABELS: Record<ViewMode, string> = { day: 'Day', week: 'Week', month: 'Month' };
const MODE_ICONS: Record<ViewMode, React.ComponentPropsWithRef<typeof Ionicons>['name']> = {
  day: 'today-outline', week: 'calendar-outline', month: 'calendar-number-outline',
};

export default function ScheduleScreen() {
  const { companyId, personId, name: personName } = useAuthStore();
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mode, setMode] = useState<ViewMode>('week');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ScheduleShiftDto | null>(null);

  const { from, to } = useMemo(() => {
    if (mode === 'day') return { from: getStartOfDay(selectedDate), to: getEndOfDay(selectedDate) };
    if (mode === 'month') return { from: getStartOfMonth(selectedDate), to: getEndOfMonth(selectedDate) };
    return { from: getStartOfWeek(selectedDate), to: getEndOfWeek(selectedDate) };
  }, [selectedDate, mode]);

  const { isOnline, loading, error, shifts, events } = useScheduleData(companyId, personId, from, to);
  const companyTimeZone = useCompanyTimeZone(companyId);

  useEffect(() => {
    (async () => {
      try {
        if (companyId && personId && !personName) {
          const person = await peopleService.getPersonById(companyId, personId);
          if (person) setPersonProfile({ name: person.name ?? null, email: person.email ?? null });
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
    Haptics.selectionAsync();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hero header */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <Animated.View entering={FadeIn.duration(350)}>
          <Text style={styles.heroTitle}>Schedule</Text>
          {!isOnline && (
            <View style={styles.offlinePill}>
              <Ionicons name="cloud-offline-outline" size={12} color={colors.warning} />
              <Text style={styles.offlineText}>Offline · cached data</Text>
            </View>
          )}
        </Animated.View>
        <PressableScale
          style={styles.rangeBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickerOpen(true); }}
        >
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text style={styles.rangeBtnText}>{formatDate(from)}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} />
        </PressableScale>
      </View>

      {/* Mode switcher pill row */}
      <View style={styles.modeSwitcher}>
        {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
          <PressableScale
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => { setMode(m); Haptics.selectionAsync(); }}
          >
            <Ionicons name={MODE_ICONS[m]} size={14} color={mode === m ? '#fff' : colors.muted} />
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{MODE_LABELS[m]}</Text>
          </PressableScale>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shifts */}
        <View style={styles.section}>
          <SectionHeader
            title={`Shifts · ${mode === 'day' ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`}`}
          />
          {loading && [0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={76} borderRadius={13} style={{ marginBottom: 10 }} />
          ))}
          {!loading && shifts.length === 0 && (
            <EmptyState title="No shifts" message="No shifts scheduled for this period." icon="calendar-clear-outline" />
          )}
          {!loading && shifts.map((s, i) => (
            <Animated.View key={s.scheduleShiftId} entering={FadeInDown.delay(i * 60).duration(300)}>
              <PressableScale style={styles.card} onPress={() => setSelectedShift(s)}>
                <View style={styles.cardDateCol}>
                  <Text style={styles.cardDateNum}>{new Date(s.startDate).getDate()}</Text>
                  <Text style={styles.cardDateMon}>
                    {new Date(s.startDate).toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTime}>
                    {formatScheduleTime(s.startDate, companyTimeZone ?? undefined)} – {formatScheduleTime(s.endDate, companyTimeZone ?? undefined)}
                  </Text>
                  <Text style={styles.cardMeta}>Shift #{s.scheduleShiftId} · {s.status}</Text>
                </View>
                <View style={[styles.statusDot, s.status === 'Confirmed' ? styles.dotGreen : styles.dotBlue]} />
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        {/* Events */}
        <View style={styles.section}>
          <SectionHeader title="Clocked Events" />
          {loading && [0, 1].map((i) => (
            <Skeleton key={i} width="100%" height={60} borderRadius={13} style={{ marginBottom: 10 }} />
          ))}
          {!loading && events.length === 0 && (
            <EmptyState title="No events" message="No events recorded for this period." icon="pulse-outline" />
          )}
          {!loading && events.map((e, i) => (
            <Animated.View key={e.eventLogId} entering={FadeInDown.delay(i * 50).duration(280)}>
              <View style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventType}>{e.eventType.replace(/_/g, ' ')}</Text>
                  <Text style={styles.eventMeta}>{formatDate(e.eventDate)} · {formatTime(e.eventDate)}</Text>
                </View>
              </View>
            </Animated.View>
          ))}
          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Range/mode picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Schedule View</Text>

            {/* Mode chips */}
            <Text style={styles.sheetLabel}>View By</Text>
            <View style={styles.chipRow}>
              {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
                <PressableScale
                  key={m}
                  style={[styles.chip, mode === m && styles.chipActive]}
                  onPress={() => { setMode(m); Haptics.selectionAsync(); }}
                >
                  <Ionicons name={MODE_ICONS[m]} size={15} color={mode === m ? '#fff' : colors.text} />
                  <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>{MODE_LABELS[m]}</Text>
                </PressableScale>
              ))}
            </View>

            {/* Navigate */}
            <Text style={styles.sheetLabel}>Navigate</Text>
            <View style={styles.navRow}>
              <PressableScale style={styles.navBtn} onPress={() => shiftDate(-1)}>
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
                <Text style={styles.navBtnText}>Prev</Text>
              </PressableScale>
              <Text style={styles.selDate}>{formatDate(selectedDate)}</Text>
              <PressableScale style={styles.navBtn} onPress={() => shiftDate(1)}>
                <Text style={styles.navBtnText}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </PressableScale>
            </View>

            <PressableScale
              style={styles.doneBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickerOpen(false); }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <ShiftDetailModal
        visible={!!selectedShift}
        shift={selectedShift}
        timeZoneId={companyTimeZone}
        onClose={() => setSelectedShift(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  offlineText: { fontSize: 12, color: 'rgba(255,255,255,0.80)' },
  rangeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, marginBottom: 2,
  },
  rangeBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  // Mode switcher
  modeSwitcher: {
    flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg,
    paddingVertical: 10, backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  modeTextActive: { color: '#fff' },

  // Shifts
  section: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardDateCol: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center',
  },
  cardDateNum: { fontSize: 16, fontWeight: '700', color: colors.primary, lineHeight: 18 },
  cardDateMon: { fontSize: 10, fontWeight: '600', color: colors.primary, opacity: 0.75 },
  cardTime: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  cardMeta: { fontSize: 12, color: colors.muted },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: colors.success },
  dotBlue:  { backgroundColor: colors.primary },

  // Events
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, marginBottom: 8,
  },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  eventType: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
  eventMeta: { fontSize: 12, color: colors.muted },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  error: { fontSize: 13, color: colors.danger },

  // Bottom sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg, paddingBottom: 36,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderOpaque, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 20 },
  sheetLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#fff' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  navBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  selDate: { fontSize: 15, fontWeight: '700', color: colors.text },
  doneBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
