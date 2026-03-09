import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useState, useMemo } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatTime } from '@/utils/date.utils';
import { colors, spacing } from '@/styles/tokens';
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
          <Pressable onPress={() => { setPage(1); setModalVisible(true); }}>
            <Text style={styles.link}>View more</Text>
          </Pressable>
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
        <Card style={styles.card}>
          <Text style={styles.cardText}>{e.eventType.replace('_', ' ')}</Text>
          <Text style={styles.cardDate}>{formatDate(e.eventDate)} {formatTime(e.eventDate)}</Text>
        </Card>
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Activity</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              {paged.map((e) => (
                <Card key={e.eventLogId} style={styles.card}>
                  <Text style={styles.cardText}>{e.eventType.replace('_', ' ')}</Text>
                  <Text style={styles.cardDate}>{formatDate(e.eventDate)} {formatTime(e.eventDate)}</Text>
                </Card>
              ))}
            </ScrollView>
            {recentEvents.length > PAGE_SIZE && (
              <View style={styles.pagination}>
                <Pressable
                  style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                  disabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </Pressable>
                <Text style={styles.pageIndicator}>{page} / {totalPages}</Text>
                <Pressable
                  style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                  disabled={page === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.lg, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: 12, marginBottom: 12 },
  cardText: { fontSize: 14, color: colors.text, marginBottom: 4 },
  cardDate: { fontSize: 12, color: colors.muted },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
  emptyText: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '80%', paddingBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  pagination: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 8,
  },
  pageBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  pageIndicator: { fontSize: 12, color: colors.muted },
});
