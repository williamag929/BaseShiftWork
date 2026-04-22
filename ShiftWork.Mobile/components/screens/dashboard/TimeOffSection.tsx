import { View, Text, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EmptyState, SectionHeader } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatDate } from '@/utils/date.utils';
import { colors, spacing, radius } from '@/styles/tokens';
import type { TimeOffRequest } from '@/services/time-off-request.service';

interface TimeOffSectionProps {
  loading: boolean;
  requests: TimeOffRequest[];
  onRequest: () => void;
}

const STATUS_BG: Record<string, string> = {
  Approved: colors.success,
  Denied: colors.danger,
  Pending: colors.warning,
};

const CARD_BORDER: Record<string, ViewStyle> = {
  Approved: { borderLeftWidth: 4, borderLeftColor: colors.success },
  Denied: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  Pending: { borderLeftWidth: 4, borderLeftColor: colors.warning },
};

export function TimeOffSection({ loading, requests, onRequest }: TimeOffSectionProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Time Off"
        rightSlot={
          <PressableScale
            style={styles.requestBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRequest(); }}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.requestBtnText}>Request</Text>
          </PressableScale>
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
          <PressableScale
            style={styles.ctaBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRequest(); }}
          >
            <Ionicons name="airplane-outline" size={16} color="#fff" />
            <Text style={styles.ctaBtnText}>Request Time Off</Text>
          </PressableScale>
        </View>
      )}
      {!loading && requests.map((req) => (
        <View key={req.timeOffRequestId} style={[styles.card, CARD_BORDER[req.status] ?? {}]}>
          <View style={styles.reqHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{req.type}</Text>
              <Text style={styles.dates}>{formatDate(req.startDate)} – {formatDate(req.endDate)}</Text>
            </View>
            <View style={[styles.badge, {
              backgroundColor: req.status === 'Approved' ? 'rgba(52,199,89,0.14)'
                : req.status === 'Denied' ? 'rgba(255,59,48,0.12)'
                : 'rgba(255,149,0,0.14)',
            }]}>
              <Ionicons
                name={req.status === 'Approved' ? 'checkmark-circle' : req.status === 'Denied' ? 'close-circle' : 'time'}
                size={12}
                color={STATUS_BG[req.status] ?? colors.muted}
              />
              <Text style={[styles.badgeText, { color: STATUS_BG[req.status] ?? colors.muted }]}>{req.status}</Text>
            </View>
          </View>
          {!!req.hoursRequested && (
            <Text style={styles.meta}><Text style={{ fontWeight: '600' }}>{req.hoursRequested}h</Text> requested</Text>
          )}
          {!!req.reason && <Text style={styles.reason}>"{req.reason}"</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 4 },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  requestBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dates: { fontSize: 13, color: colors.muted },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  reason: { fontSize: 12, color: colors.muted, marginTop: 4, fontStyle: 'italic' },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, backgroundColor: colors.primary,
    paddingVertical: 12, borderRadius: radius.lg,
  },
  ctaBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
