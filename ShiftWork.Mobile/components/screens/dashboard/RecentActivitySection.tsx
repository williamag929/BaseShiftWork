import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { useState, useMemo } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatDate, formatTime } from '@/utils/date.utils';
import { colors, spacing, radius } from '@/styles/tokens';
import type { ShiftEventDto } from '@/types/api';

interface RecentActivitySectionProps {
  loading: boolean;
  recentEvents: ShiftEventDto[];
  error?: string | null;
}

const PAGE_SIZE = 10;

export function RecentActivitySection({ loading, recentEvents, error }: RecentActivitySectionProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [page, setPage] = useState(1);

  const preview = useMemo(() => recentEvents.slice(0, 4), [recentEvents]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(recentEvents.length / PAGE_SIZE)),
    [recentEvents.length]
  );
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return recentEvents.slice(start, start + PAGE_SIZE);
  }, [recentEvents, page]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentEvents.length > 4 && (
          <PressableScale onPress={() => { setPage(1); setModalVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
            <Text style={styles.link}>View all</Text>
          </PressableScale>
        )}
      </View>

      {loading && [0,1,2,3].map((i) => <Skeleton key={i} width="100%" height={60} borderRadius={12} style={{ marginBottom: 12 }} />)}
      {!loading && recentEvents.length === 0 && (
        <View style={styles.emptyRow}>
          <Ionicons name="pulse-outline" size={18} color={colors.muted} />
          <Text style={styles.emptyText}>No recent activity</Text>
        </View>
      )}
      {!loading && preview.map((e, i) => (
        <Animated.View key={e.eventLogId} entering={FadeInDown.delay(i * 60).duration(300)}>
          <View style={styles.card}>
            <View style={styles.cardDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardText}>{e.eventType.replace(/_/g, ' ')}</Text>
              <Text style={styles.cardDate}>{formatDate(e.eventDate)} · {formatTime(e.eventDate)}</Text>
            </View>
          </View>
        </Animated.View>
      ))}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalBox}>
            <View style={styles.handleBar} />
          <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Activity</Text>
              <PressableScale onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={colors.muted} />
              </PressableScale>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              {paged.map((e) => (
                <View key={e.eventLogId} style={styles.card}>
                  <View style={styles.cardDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardText}>{e.eventType.replace(/_/g, ' ')}</Text>
                    <Text style={styles.cardDate}>{formatDate(e.eventDate)} · {formatTime(e.eventDate)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            {recentEvents.length > PAGE_SIZE && (
              <View style={styles.pagination}>
                <PressableScale
                  style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                  disabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Ionicons name="chevron-back" size={14} color="#fff" />
                  <Text style={styles.pageBtnText}>Prev</Text>
                </PressableScale>
                <Text style={styles.pageIndicator}>{page} / {totalPages}</Text>
                <PressableScale
                  style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                  disabled={page === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </PressableScale>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, marginBottom: 8,
  },
  cardDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cardText: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 2 },
  cardDate: { fontSize: 12, color: colors.muted },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  emptyText: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, marginTop: 8, fontSize: 13 },
  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%', paddingBottom: spacing.xl,
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderOpaque, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  pagination: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 8,
  },
  pageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  pageIndicator: { fontSize: 13, color: colors.muted, fontWeight: '500' },
});
