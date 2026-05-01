import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { documentService, DocumentDetail } from '@/services/document.service';
import { colors, spacing, radius } from '@/styles/tokens';

const TYPE_ICON: Record<string, React.ComponentPropsWithRef<typeof Ionicons>['name']> = {
  SafetyDataSheet: 'warning-outline',
  FloorPlan:       'map-outline',
  Manual:          'book-outline',
  Policy:          'shield-outline',
  Procedure:       'list-outline',
  ProductInfo:     'information-circle-outline',
  Other:           'document-outline',
};

const ACCESS_LABEL: Record<string, { label: string; color: string }> = {
  Public:       { label: 'All Employees', color: colors.success },
  LocationOnly: { label: 'Location Only', color: colors.warning },
  Restricted:   { label: 'Restricted',    color: colors.danger },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function MetaRow({ icon, label, value, valueColor }: {
  icon: React.ComponentPropsWithRef<typeof Ionicons>['name'];
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={colors.muted} style={styles.metaIcon} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export default function DocumentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useAuthStore();

  const [detail, setDetail]   = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    documentService.getById(companyId, id)
      .then(setDetail)
      .catch(() => Alert.alert('Error', 'Could not load document.'))
      .finally(() => setLoading(false));
  }, [companyId, id]);

  const openDocument = async () => {
    if (!detail?.presignedUrl) return;
    setOpening(true);
    try {
      await Linking.openURL(detail.presignedUrl);
    } catch {
      Alert.alert('Error', 'Could not open document.');
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!detail) return null;

  const icon = TYPE_ICON[detail.type] ?? 'document-outline';
  const access = ACCESS_LABEL[detail.accessLevel];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={styles.backText}>Documents</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Document hero */}
        <View style={styles.docHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={32} color={colors.primary} />
          </View>
          <View style={styles.docHeaderText}>
            <Text style={styles.docTitle}>{detail.title}</Text>
            <Text style={styles.docType}>{detail.type.replace(/([A-Z])/g, ' $1').trim()}</Text>
          </View>
        </View>

        {/* Open button */}
        <TouchableOpacity style={styles.openBtn} onPress={openDocument} disabled={opening} activeOpacity={0.85}>
          {opening
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.openBtnText}>Open Document</Text>
              </>
          }
        </TouchableOpacity>

        {/* Description */}
        {!!detail.description && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.sectionBody}>{detail.description}</Text>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.metaGrid}>
          <MetaRow icon="layers-outline"   label="Version"     value={`v${detail.version}`} />
          <MetaRow icon="document-outline" label="File Size"   value={formatBytes(detail.fileSize)} />
          <MetaRow icon="person-outline"   label="Uploaded By" value={detail.uploadedByName} />
          <MetaRow icon="calendar-outline" label="Added"       value={new Date(detail.createdAt).toLocaleDateString()} />
          <MetaRow icon="eye-outline"      label="Total Opens" value={`${detail.totalReads}`} />
          <MetaRow
            icon="shield-outline"
            label="Access"
            value={access?.label ?? detail.accessLevel}
            valueColor={access?.color}
          />
        </View>

        {/* Tags */}
        {detail.tags && detail.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagRow}>
              {detail.tags.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  centered:      { alignItems: 'center', justifyContent: 'center' },
  navBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 2, padding: spacing.sm },
  backText:      { fontSize: 17, color: colors.primary },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  docHeader:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle:    { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  docHeaderText: { flex: 1 },
  docTitle:      { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 26 },
  docType:       { fontSize: 13, color: colors.muted, marginTop: 3 },
  openBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16 },
  openBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  section:       { gap: 8 },
  sectionLabel:  { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.7 },
  sectionBody:   { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  metaGrid:      { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  metaRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  metaIcon:      { marginRight: spacing.sm },
  metaLabel:     { flex: 1, fontSize: 14, color: colors.text },
  metaValue:     { fontSize: 14, color: colors.muted, fontWeight: '500' },
  tagRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:           { backgroundColor: colors.fill, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  tagText:       { fontSize: 13, color: colors.textSecondary },
});
