import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity, TextInput,
  ActivityIndicator, // used by the loading spinner below
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { documentService, Document } from '@/services/document.service';
import { colors, spacing, radius } from '@/styles/tokens';
import { EmptyState } from '@/components/ui';

const TYPE_ICON: Record<string, React.ComponentPropsWithRef<typeof Ionicons>['name']> = {
  SafetyDataSheet: 'warning-outline',
  FloorPlan:       'map-outline',
  Manual:          'book-outline',
  Policy:          'shield-outline',
  Procedure:       'list-outline',
};

const ACCESS_COLOR: Record<string, string> = {
  Public:      '#34C759',
  LocationOnly:'#FF9500',
  Restricted:  '#FF3B30',
};

export default function DocumentsScreen() {
  const router = useRouter();
  const { companyId } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await documentService.getDocuments(companyId, undefined, undefined, search || undefined);
      setDocuments(data);
    } catch {
      setError('Could not load documents. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, search]);

  useEffect(() => { load(); }, [companyId]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const openDocument = (doc: Document) => {
    router.push(`/documents/${doc.documentId}` as any);
  };

  const renderItem = ({ item, index }: { item: Document; index: number }) => {
    const icon = TYPE_ICON[item.type] ?? 'document-outline';

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
        <TouchableOpacity style={styles.card} onPress={() => openDocument(item)} activeOpacity={0.75}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {item.description && <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>}
            <View style={styles.cardMeta}>
              <Text style={styles.typeChip}>{item.type}</Text>
              <Text style={styles.version}>v{item.version}</Text>
              <View style={[styles.accessDot, { backgroundColor: ACCESS_COLOR[item.accessLevel] ?? colors.muted }]} />
              <Text style={styles.accessLabel}>{item.accessLevel}</Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Documents', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load()}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); load(); }}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
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
          data={documents}
          keyExtractor={d => d.documentId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" title="No documents" message="No documents available for your account" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { paddingHorizontal: spacing.md, paddingBottom: 8 },
  headerTitle:  { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: 12, backgroundColor: colors.surface, borderRadius: radius.md ?? 8, paddingHorizontal: 12, height: 42 },
  searchIcon:   { marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 15, color: colors.text },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard:    { margin: spacing.md, padding: spacing.lg, backgroundColor: '#FFF1F0', borderRadius: 12, alignItems: 'center', gap: 10 },
  errorText:    { fontSize: 14, color: '#FF3B30', textAlign: 'center', lineHeight: 20 },
  retryBtn:     { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B30' },
  retryText:    { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg ?? 12, padding: 14 },
  iconWrap:     { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  cardBody:     { flex: 1, gap: 4 },
  cardTitle:    { fontSize: 15, fontWeight: '600', color: colors.text },
  cardDesc:     { fontSize: 13, color: colors.muted },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  typeChip:     { fontSize: 11, color: colors.muted, fontWeight: '500' },
  version:      { fontSize: 11, color: colors.muted },
  accessDot:    { width: 7, height: 7, borderRadius: 4 },
  accessLabel:  { fontSize: 11, color: colors.muted },
});
