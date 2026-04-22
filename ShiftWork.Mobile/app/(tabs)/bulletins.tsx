import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { bulletinService, Bulletin } from '@/services/bulletin.service';
import { colors, spacing, radius } from '@/styles/tokens';
import { EmptyState } from '@/components/ui';

const PRIORITY_COLOR: Record<string, string> = {
  Critical: colors.danger ?? '#FF3B30',
  High:     '#FF9500',
  Normal:   colors.primary,
  Low:      colors.muted ?? '#8E8E93',
};

export default function BulletinsScreen() {
  const { companyId } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<'all' | 'unread' | 'urgent'>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await bulletinService.getBulletins(companyId);
      setBulletins(data.filter(b => b.status !== 'Archived'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const filtered = bulletins.filter(b => {
    if (filter === 'unread')  return !b.isReadByCurrentUser && b.status === 'Published';
    if (filter === 'urgent')  return b.priority === 'Critical' || b.type === 'Urgent';
    return true;
  });

  const openBulletin = async (b: Bulletin) => {
    if (!b.isReadByCurrentUser) {
      bulletinService.markAsRead(companyId, b.bulletinId).catch(() => {});
      setBulletins(prev =>
        prev.map(x => x.bulletinId === b.bulletinId ? { ...x, isReadByCurrentUser: true } : x)
      );
    }
    router.push(`/bulletins/${b.bulletinId}` as any);
  };

  const unreadCount = bulletins.filter(b => !b.isReadByCurrentUser && b.status === 'Published').length;

  const renderItem = ({ item, index }: { item: Bulletin; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
      <TouchableOpacity style={[styles.card, !item.isReadByCurrentUser && styles.cardUnread]} onPress={() => openBulletin(item)} activeOpacity={0.75}>
        <View style={styles.cardLeft}>
          <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[item.priority] ?? colors.primary }]} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardMeta}>
            <Text style={styles.typeLabel}>{item.type}</Text>
            {!item.isReadByCurrentUser && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.cardTitle, !item.isReadByCurrentUser && styles.cardTitleBold]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardPreview} numberOfLines={2}>{item.content}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardAuthor}>{item.createdByName}</Text>
            <View style={styles.readCount}>
              <Ionicons name="eye-outline" size={12} color={colors.muted} />
              <Text style={styles.readCountText}>{item.totalReads}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} style={styles.chevron} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bulletins</Text>
        {unreadCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {(['all', 'unread', 'urgent'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'all' ? 'All' : f === 'unread' ? `Unread${unreadCount ? ` (${unreadCount})` : ''}` : 'Urgent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.bulletinId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="megaphone-outline" title="No bulletins" message="Check back later for updates" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 8, gap: 8 },
  headerTitle:     { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  headerBadge:     { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingBottom: 12 },
  pill:            { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border ?? '#E5E5EA' },
  pillActive:      { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText:        { fontSize: 13, color: colors.text, fontWeight: '500' },
  pillTextActive:  { color: '#fff' },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:            { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg ?? 12, overflow: 'hidden', minHeight: 80 },
  cardUnread:      { backgroundColor: '#EBF3FF' },
  cardLeft:        { width: 4 },
  priorityBar:     { flex: 1 },
  cardBody:        { flex: 1, padding: 12, gap: 3 },
  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeLabel:       { fontSize: 11, color: colors.muted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  unreadDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  cardTitle:       { fontSize: 15, color: colors.text, fontWeight: '400' },
  cardTitleBold:   { fontWeight: '700' },
  cardPreview:     { fontSize: 13, color: colors.muted, lineHeight: 18 },
  cardFooter:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardAuthor:      { fontSize: 11, color: colors.muted },
  readCount:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  readCountText:   { fontSize: 11, color: colors.muted },
  chevron:         { alignSelf: 'center', marginRight: 8 },
});
