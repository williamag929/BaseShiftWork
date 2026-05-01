import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { safetyService, SafetyContent } from '@/services/safety.service';
import { colors, spacing, radius } from '@/styles/tokens';
import { EmptyState } from '@/components/ui';

const TYPE_ICON: Record<string, React.ComponentPropsWithRef<typeof Ionicons>['name']> = {
  ToolboxTalk:       'construct-outline',
  SafetyDataSheet:   'warning-outline',
  Orientation:       'school-outline',
  InstructionalVideo:'play-circle-outline',
  Training:          'ribbon-outline',
};

export default function SafetyScreen() {
  const router = useRouter();
  const { companyId } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [contents, setContents]   = useState<SafetyContent[]>([]);
  const [pending, setPending]     = useState<SafetyContent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'all' | 'pending'>('pending');
  const [acking, setAcking]       = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [all, pend] = await Promise.all([
        safetyService.getContents(companyId),
        safetyService.getPending(companyId),
      ]);
      setContents(all);
      setPending(pend);
    } catch {
      setError('Could not load safety content. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const acknowledge = async (item: SafetyContent) => {
    setAcking(item.safetyContentId);
    try {
      await safetyService.acknowledge(companyId, item.safetyContentId);
      setContents(prev => prev.map(c =>
        c.safetyContentId === item.safetyContentId ? { ...c, isAcknowledgedByCurrentUser: true } : c
      ));
      setPending(prev => prev.filter(c => c.safetyContentId !== item.safetyContentId));
    } catch {
      Alert.alert('Error', 'Could not save acknowledgment. Please try again.');
    } finally {
      setAcking(null);
    }
  };

  const display = tab === 'pending' ? pending : contents;

  const renderItem = ({ item, index }: { item: SafetyContent; index: number }) => {
    const isAcking = acking === item.safetyContentId;
    const icon = TYPE_ICON[item.type] ?? 'shield-checkmark-outline';

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
        <TouchableOpacity
          style={[styles.card, item.isAcknowledgedByCurrentUser && styles.cardAcked]}
          onPress={() => router.push(`/safety/${item.safetyContentId}` as any)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.typeLabel}>{item.type}</Text>
              {item.isAcknowledgmentRequired && !item.isAcknowledgedByCurrentUser && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>Action Required</Text>
                </View>
              )}
              {item.isAcknowledgedByCurrentUser && (
                <View style={styles.ackedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.ackedText}>Acknowledged</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>

          {!!item.textContent && (
            <Text style={styles.cardText} numberOfLines={4}>{item.textContent}</Text>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.footerMeta}>{item.createdByName}</Text>
            {item.durationMinutes != null && (
              <Text style={styles.footerMeta}>{item.durationMinutes} min</Text>
            )}
          </View>

          {item.isAcknowledgmentRequired && !item.isAcknowledgedByCurrentUser && (
            <TouchableOpacity
              style={[styles.ackBtn, isAcking && styles.ackBtnDisabled]}
              onPress={(e) => { e.stopPropagation?.(); acknowledge(item); }}
              disabled={isAcking}
              activeOpacity={0.8}
            >
              {isAcking
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                    <Text style={styles.ackBtnText}>I Acknowledge</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Safety</Text>
        {pending.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{pending.length}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'pending' && styles.tabBtnActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pending{pending.length > 0 ? ` (${pending.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>All Content</Text>
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error && !loading && (
        <View style={styles.errorCard}>
          <Ionicons name="wifi-outline" size={28} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : !error && (
        <FlatList
          data={display}
          keyExtractor={c => c.safetyContentId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="shield-checkmark-outline"
              title={tab === 'pending' ? "All caught up!" : "No safety content"}
              message={tab === 'pending' ? "No pending acknowledgments" : "Check back later"}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 8, gap: 8 },
  headerTitle:      { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  headerBadge:      { backgroundColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabRow:           { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginBottom: 12 },
  tabBtn:           { flex: 1, paddingVertical: 8, borderRadius: radius.md ?? 8, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border ?? '#E5E5EA' },
  tabBtnActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:          { fontSize: 14, fontWeight: '500', color: colors.text },
  tabTextActive:    { color: '#fff' },
  centered:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard:        { margin: spacing.md, padding: spacing.lg, backgroundColor: '#FFF1F0', borderRadius: 12, alignItems: 'center', gap: 10 },
  errorText:        { fontSize: 14, color: '#FF3B30', textAlign: 'center', lineHeight: 20 },
  retryBtn:         { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B30' },
  retryText:        { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  card:             { backgroundColor: colors.surface, borderRadius: radius.lg ?? 12, padding: 16, borderLeftWidth: 3, borderLeftColor: colors.border ?? '#E5E5EA' },
  cardAcked:        { borderLeftColor: '#34C759' },
  cardHeader:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  iconWrap:         { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  cardMeta:         { flex: 1, gap: 4 },
  typeLabel:        { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionBadge:      { alignSelf: 'flex-start', backgroundColor: '#FFE5E5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  actionBadgeText:  { color: '#FF3B30', fontSize: 11, fontWeight: '600' },
  ackedBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ackedText:        { color: '#34C759', fontSize: 12, fontWeight: '600' },
  cardTitle:        { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardDesc:         { fontSize: 14, color: colors.muted, lineHeight: 20 },
  cardText:         { marginTop: 8, padding: 10, backgroundColor: colors.background, borderRadius: 8, fontSize: 13, color: colors.text, lineHeight: 19 },
  cardFooter:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footerMeta:       { fontSize: 11, color: colors.muted },
  ackBtn:           { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md ?? 8, paddingVertical: 13 },
  ackBtnDisabled:   { opacity: 0.6 },
  ackBtnText:       { color: '#fff', fontSize: 15, fontWeight: '700' },
});
