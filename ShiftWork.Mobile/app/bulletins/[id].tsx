import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { bulletinService, Bulletin } from '@/services/bulletin.service';
import { colors, spacing, radius } from '@/styles/tokens';

const PRIORITY_COLOR: Record<string, string> = {
  Critical: '#FF3B30',
  High:     '#FF9500',
  Normal:   colors.primary,
  Low:      colors.muted ?? '#8E8E93',
};

export default function BulletinDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await bulletinService.getById(companyId, id);
        setBulletin(data);
        if (!data.isReadByCurrentUser) {
          bulletinService.markAsRead(companyId, id).catch(() => {});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, companyId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Bulletin' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!bulletin) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Bulletin' }} />
        <Text style={styles.errorText}>Bulletin not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {/* Priority bar */}
        <View style={[styles.priorityBanner, { backgroundColor: PRIORITY_COLOR[bulletin.priority] ?? colors.primary }]}>
          <Text style={styles.priorityText}>{bulletin.priority} · {bulletin.type}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{bulletin.title}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={colors.muted} />
            <Text style={styles.metaText}>{bulletin.createdByName}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={styles.metaText}>
              {new Date(bulletin.publishedAt).toLocaleDateString()}
            </Text>
            {bulletin.expiresAt && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={[styles.metaText, styles.expires]}>
                  Expires {new Date(bulletin.expiresAt).toLocaleDateString()}
                </Text>
              </>
            )}
          </View>

          <Text style={styles.content}>{bulletin.content}</Text>

          {/* Attachments */}
          {bulletin.attachmentUrls && bulletin.attachmentUrls.length > 0 && (
            <View style={styles.attachments}>
              <Text style={styles.attachTitle}>Attachments</Text>
              {bulletin.attachmentUrls.map((url, i) => (
                <TouchableOpacity key={i} style={styles.attachItem} onPress={() => Linking.openURL(url)}>
                  <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                  <Text style={styles.attachUrl} numberOfLines={1}>Attachment {i + 1}</Text>
                  <Ionicons name="open-outline" size={14} color={colors.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Read confirmation */}
          <View style={styles.readConfirm}>
            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
            <Text style={styles.readConfirmText}>Marked as read</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText:        { fontSize: 16, color: colors.muted, marginBottom: 12 },
  backBtn:          { padding: 12 },
  backBtnText:      { color: colors.primary, fontSize: 15 },
  scroll:           { flexGrow: 1 },
  priorityBanner:   { paddingHorizontal: spacing.md, paddingVertical: 8 },
  priorityText:     { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  body:             { padding: spacing.md },
  title:            { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12, letterSpacing: -0.3 },
  metaRow:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20, flexWrap: 'wrap' },
  metaText:         { fontSize: 13, color: colors.muted },
  metaDot:          { color: colors.muted },
  expires:          { color: '#FF9500' },
  content:          { fontSize: 16, color: colors.text, lineHeight: 26 },
  attachments:      { marginTop: 24 },
  attachTitle:      { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  attachItem:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.surface, borderRadius: radius.md ?? 8, marginBottom: 8 },
  attachUrl:        { flex: 1, fontSize: 14, color: colors.primary },
  readConfirm:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 32, padding: 12, backgroundColor: '#E8F8ED', borderRadius: radius.md ?? 8 },
  readConfirmText:  { fontSize: 14, color: '#248A3D', fontWeight: '500' },
});
