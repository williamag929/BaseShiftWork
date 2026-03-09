import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Card, EmptyState, SectionHeader } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/utils/date.utils';
import { colors, spacing } from '@/styles/tokens';
import type { TimeOffRequest } from '@/services/time-off-request.service';

interface TimeOffSectionProps {
  loading: boolean;
  requests: TimeOffRequest[];
  onRequest: () => void;
}

const STATUS_BG: Record<string, string> = {
  Approved: '#27AE60',
  Denied: '#E74C3C',
  Pending: '#F39C12',
};

const CARD_BORDER: Record<string, ViewStyle> = {
  Approved: { borderLeftWidth: 4, borderLeftColor: '#27AE60' },
  Denied: { borderLeftWidth: 4, borderLeftColor: '#E74C3C' },
  Pending: { borderLeftWidth: 4, borderLeftColor: '#F39C12' },
};

export function TimeOffSection({ loading, requests, onRequest }: TimeOffSectionProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Time Off"
        rightSlot={
          <Pressable style={styles.requestBtn} onPress={onRequest}>
            <Text style={styles.requestBtnText}>+ Request</Text>
          </Pressable>
        }
      />
      {loading && [0,1,2].map((i) => <Skeleton key={i} width="100%" height={64} borderRadius={12} style={{ marginBottom: 12 }} />)}
      {!loading && requests.length === 0 && (
        <View>
          <EmptyState
            title="No time off scheduled"
            message="Submit a request to notify your manager."
            icon="airplane-outline"
          />
          <Pressable style={styles.linkBtn} onPress={onRequest}>
            <Text style={styles.linkBtnText}>Request Time Off</Text>
          </Pressable>
        </View>
      )}
      {!loading && requests.map((req) => (
        <Card key={req.timeOffRequestId} style={[styles.card, CARD_BORDER[req.status] ?? {}]}>
          <View style={styles.reqHeader}>
            <Text style={styles.cardTitle}>{req.type}</Text>
            <View style={[styles.badge, { backgroundColor: STATUS_BG[req.status] ?? colors.muted }]}>
              <Text style={styles.badgeText}>{req.status}</Text>
            </View>
          </View>
          <Text style={styles.dates}>{formatDate(req.startDate)} - {formatDate(req.endDate)}</Text>
          {!!req.hoursRequested && <Text style={styles.meta}>{req.hoursRequested} hours</Text>}
          {!!req.reason && <Text style={styles.reason}>{req.reason}</Text>}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.lg, paddingTop: 8 },
  requestBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: 8,
  },
  requestBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: 12, marginBottom: 12 },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dates: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  reason: { fontSize: 13, color: colors.muted, marginTop: 6, fontStyle: 'italic' },
  linkBtn: { marginTop: 12, padding: 12, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center' },
  linkBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
